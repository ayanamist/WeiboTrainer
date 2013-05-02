// ==UserScript==
// @name WeiboTrainer
// @namespace WeiboTrainer
// @author ayanamist
// @description Modify sina weibo web page.
// @match http://weibo.com/*
// @match http://www.weibo.com/*
// @match http://account.weibo.com/*
// @version 1.0
// @run-at document-start
// @grant GM_listValues
// @grant GM_getValue
// @grant GM_setValue
// ==/UserScript==

//noinspection ThisExpressionReferencesGlobalObjectJS
(function (window) {
    var document = window.document,
        Array = window.Array,
        CustomEvent = window.CustomEvent,
        Math = window.Math;

    var Utils = {
        isReady: function () {
            return /interactive|complete/i.test(document.readyState);
        },
        _deferQueue: [],
        init: function () {
            var finishQueue = function () {
                    document.removeEventListener("DOMContentLoaded", listener);
                    Array.prototype.forEach.call(Utils._deferQueue, function (func) {
                        func();
                    });
                    Utils._deferQueue = [];
                },
                listener = document.addEventListener("DOMContentLoaded", finishQueue, false);

            if (Utils.isReady()) {
                finishQueue();
            }
        },
        deferReady: function (func) {
            Utils._deferQueue.push(func);
        },
        makeRandomStr: function (length) {
            var possibleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
                text = "",
                i = 0;
            for (; i < length; i += 1) {
                text += possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
            }
            return text;
        },
        removeNodeBySelector: function (selector) {
            var nodes = document.querySelectorAll(selector),
                i = nodes.length - 1,
                node;
            for (; i >= 0; i -= 1) {
                node = nodes[i];
                node.parentNode.removeChild(node);
            }
        },
        addNamedStyle: function (css, name) {
            var style = document.getElementById(name);
            if (!style) {
                style = document.createElement("style");
                style.type = "text/css";
                style.id = name;
                (document.head || document.documentElement).appendChild(style);
            }
            style.innerHTML = css;
        },
        trigger: function (node, type) {
            if (!!node) {
                var event = document.createEvent("Event");
                event.initEvent(type, true, true);
                node.dispatchEvent(event);
            }
        }
    };

    var NamePool = function (prefix) {
        this._pool = {};
        this._ptr = 0;
        this._prefix = prefix;
        this.borrow = function () {
            var keys = Object.keys(this._pool),
                key,
                i;
            for (i = keys.length - 1; i >= 0; i -= 1) {
                key = keys[i];
                if (!this._pool[key]) {
                    this._pool[key] = true;
                    return key;
                }
            }
            this._ptr += 1;
            this._pool[this._prefix + this._ptr] = true;
            return this._ptr;
        };
        this.pay = function (index) {
            if (typeof this._pool[index] !== "undefined") {
                this._pool[index] = false;
            }
        }
    };
    var ObjProxy = {
        MSG_NAME: "wbtr_" + Utils.makeRandomStr(8),
        _callbackNumPool: new NamePool("wbtrcb_"),
        _delegateScript: function (window, msgName) {
            document.addEventListener(msgName, function (evt) {
                var objName = evt.detail.name,
                    callbackName = evt.detail.callbackName,
                    args = evt.detail.args,
                    names = objName.split("."),
                    i,
                    tmpObj,
                    value = null,
                    error = null;

                for (i = names[0] === "this" ? 1 : 0, tmpObj = window; i < names.length; i += 1) {
                    if (typeof tmpObj !== "undefined") {
                        tmpObj = tmpObj[names[i]];
                    }
                    else {
                        break
                    }
                }

                if (typeof tmpObj !== "undefined") {
                    if (typeof args !== "undefined") {
                        // function call
                        if (typeof tmpObj === "function") {
                            value = tmpObj.apply(tmpObj, args);
                            console.log(tmpObj, args, value);
                        }
                        else {
                            error = objName + " is not a function, can not be called!";
                        }
                    }
                    else {
                        // get property
                        value = tmpObj;
                        console.log(objName, value);
                    }
                }
                else {
                    error = names.slice(0, i).join(".") + " does not exist!";
                }

                if (typeof callbackName !== "undefined") {
                    var event = new CustomEvent(callbackName, {
                        "canBubble": true,
                        "cancelable": false,
                        "detail": {
                            "value": value,
                            "error": error
                        }
                    });
                    document.dispatchEvent(event);
                }
            }, false);
        },
        _remoteExecute: function (detail, callback) {
            if (!Utils.isReady()) {
                // Wait until script has been executed.
                ObjProxy._readyQueue.push([detail, callback]);
                return;
            }
            if (typeof callback !== "undefined") {
                detail.callbackName = ObjProxy._callbackNumPool.borrow();
                var listener = document.addEventListener(detail.callbackName, function (evt) {
                    document.removeEventListener(detail.callbackName, listener);
                    ObjProxy._callbackNumPool.pay(detail.callbackName);
                    if (evt.detail.error !== null) {
                        console.error(evt.detail.error);
                    }
                    else {
                        callback(evt.detail.value);
                    }
                }, false);
            }
            var event = new CustomEvent(ObjProxy.MSG_NAME, {
                "canBubble": true,
                "cancelable": false,
                "detail": detail
            });
            document.dispatchEvent(event);
        },
        init: function () {
            var script = document.createElement("script");
            script.innerHTML = "(" + ObjProxy._delegateScript.toString() + ")(this, '" + ObjProxy.MSG_NAME + "');";
            script.type = "text/javascript";
            (document.head || document.documentElement).appendChild(script);
            script = null;
        },
        getByName: function (objName, callback) {
            ObjProxy._remoteExecute({
                "name": objName
            }, callback);
        },
        callByName: function (funcName, args, callback) {
            if (!Array.isArray(args)) {
                args = typeof args === "undefined" ? [] : [args];
            }
            ObjProxy._remoteExecute({
                "name": funcName,
                "args": args
            }, callback);
        }
    };

    var DOMObserver = {
        _registeredHandlers: {},
        init: function () {
            var MutationObserver = window.MutationObserver || window.WebKitMutationObserver,
                observer = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        console.log(mutation.type);
                    });
                }),
                config = {
                    childList: true,
                    subtree: true
                };
            observer.observe(document, config);
        }
    };

    var UI = {
        0: function () {
            // 可能感兴趣的人
            return "#trustPagelet_recom_interestv5 {display: none !important;}";
        },
        1: function () {
            // 浮动提示
            return ".layer_tips_intro {display: none !important;}";
        },
        2: function () {
            // 时间线上面横幅广告
            Utils.deferReady(function () {
                ObjProxy.getByName("$CONFIG.uid", function (uid) {
                    if (typeof uid !== "undefined") {
                        ObjProxy.callByName("STK.core.util.cookie.set", ["tips_" + uid, "1", {"expire": 36500}]);
                    }
                });
            });
            return "#pl_content_biztips {display: none !important;}";
        },
        3: function () {
            // 右侧边 [活动]
            return "#pl_rightmod_ads35 {display: none !important;}";
        },
        4: function () {
            // 右侧边 时间线底部横幅广告
            return "div[ad-data*=ads_bottom] {display: none !important;}";
        },
        5: function () {
            // 右侧边 热门话题、我的话题
            return "#trustPagelet_zt_hottopicv5 {display: none !important;}";
        },
        6: function () {
            // 右侧边 会员专区、会员动态
            return "#trustPagelet_recom_memberv5 {display: none !important;}";
        },
        7: function () {
            // 右侧边 微吧、微刊、应用
            return "#trustPagelet_recom_allinonev5 {display: none !important;}";
        },
        8: function () {
            // 右侧边 热门商品推荐
            return "#pl_rightmod_ads36 {display: none !important;}";
        },
        9: function () {
            // 右侧边 公告栏
            return "#pl_rightmod_noticeboard {display: none !important;}";
        },
        10: function () {
            // 左侧边 最近使用
            return "#pl_leftnav_app {display: none !important;}";
        },
        11: function () {
            // 时间线上面 热门微博
            return "div[node-type=recommendTopic] {display: none !important;}";
        },
        12: function () {
            // 时间线底部 开通会员提示
            return "div[node-type=feed_list_shieldKeyword] {display: none !important;}";
        },
        13: function () {
            // 用户页面 微关系
            return "#pl_profile_moduleHisRelation {display: none !important;}";
        },
        14: function () {
            // 用户页面 微相册
            return "#pl_profile_modulealbum {display: none !important;}";
        },
        15: function () {
            // 用户页面 应用卡片（微刊等）
            return "#trustPagelet_profile_openApplist {display: none !important;}";
        },
        16: function () {
            // 陌生用户页面 加关注提示
            return "#pl_profile_unfollow {display: none !important;}";
        },
        17: function () {
            // 用户页面 封面图
            // 注意把勋章移动到关注按钮上面
            Utils.deferReady(function () {
                var pf_tags = document.querySelector("#pl_profile_hisInfo .pf_tags"),
                    pf_badge_icon = document.querySelector("#pl_profile_cover .pf_badge_icon");
                if (pf_tags && pf_badge_icon) {
                    pf_tags.appendChild(pf_badge_icon);
                }
            });
            return ".profile_top .pf_head{top: 5px !important;}\
                  #pl_profile_cover {display: none !important;} \
                  #plc_profile_header .profile_top .pf_info_left, \
                  #plc_profile_header .profile_top .pf_info_left_border {min-height: 234px} \
                  #pl_profile_hisInfo .pf_badge_icon li {display: inline-block; margin-top: 5px;}";
        },
        18: function () {
            // 用户页面 勋章
            return ".pf_badge_icon {display: none !important;}";
        },
        19: function () {
            // 单条微博 推荐微博
            return "#pl_rightmod_recommblog {display: none !important;}";
        },
        20: function () {
            // 单条微博 推荐音乐
            return "#trustPagelet_mblog_music {display: none !important;}";
        },
        21: function () {
            // 单条微博 推荐图片
            return "#trustPagelet_mblog_photo {display: none !important;}";
        },
        22: function () {
            // 单条微博 推荐微吧
            return "#trustPagelet_mblog_weiba {display: none !important;}";
        },
        23: function () {
            // 单条微博 推荐微刊
            return "#trustPagelet_mblog_weikan {display: none !important;}";
        },
        24: function () {
            // 单条微博 热门微博
            return "#trustPagelet_mblog_hotmblog {display: none !important;}";
        },
        25: function () {
            // 单条微博 微博相关人
            return "#pl_rightmod_recomperson {display: none !important;}";
        },
        26: function () {
            // 单条微博 推荐话题
            return "#trustPagelet_mblog_topic {display: none !important;}";
        },
        27: function () {
            // 单条微博 整个右边栏
            return ".B_onefeed .W_main_c, .B_onefeed .WB_feed textarea {width: 99% !important}\
                  .B_onefeed .W_main_2r {display: none !important;}";
        },
        28: function () {
            // 用户页面 整个右边栏
            return ".B_profile .W_profile_main .W_main_c {width: auto !important;} \
                  .B_profile .W_profile_main .W_main_2r {display: none !important;}";
        },
        29: function () {
            // 整个底部链接
            return ".global_footer {display: none !important;}";
        },
        30: function () {
            // 两栏
            return ".W_main_bg {position: relative;}\
                  .W_main_l {position: absolute; right: 0; width: 230px !important;}\
                  .B_index .W_main_l {margin: 175px 0 0 0;}\
                  .WB_left_nav a.lev_curr {background-color: #e6e6e6 !important;}\
                  .WB_left_nav {width: 230px !important;}\
                  .WB_left_nav a:hover, .WB_left_nav a.lev_curr,\
                  .WB_left_nav a.lev_curr:hover {background-image: none !important;}\
                  .W_main {width: 830px !important; background-position: -150px 0;} \
                  a.W_gotop {margin-left: 415px !important;}"
        },
        31: function () {
            // 模板设置
            return "#pl_content_setSkin {display: none !important;}";
        },
        32: function () {
            // 常用边栏固定
            return ".B_index .W_main_l .WB_left_nav {position: fixed !important;} \
                  .B_index .W_main_r {position: fixed !important; margin-left: 600px;}"
        },
        33: function () {
            // 微博达人图标
            return ".WB_info .ico_club {display: none !important;}";
        },
        34: function () {
            // 微博会员图标
            return ".WB_info .ico_member {display: none !important;}";
        },
        35: function () {
            // 微博女郎图标
            return ".WB_info .ico_vlady {display: none !important;}";
        },
        36: function () {
            // 微博认证图标
            return ".WB_info .approve, .WB_info .approve_co {display: none !important;}";
        },
        37: function () {
            // 时间线上面发微博框
            return "#pl_content_publisherTop {display: none !important;}";
        },
        38: function () {
            // 微博中地点签到周围的图片
            return ".WB_feed .WB_feed_spec {display: none !important;}";
        },
        39: function () {
            // 分组页面 建议加入该分组
            return "#pl_relation_recommendGroupMember {display: none !important;}";
        },
        40: function () {
            // 时间线 推广
            return ".WB_feed .WB_feed_type[feedtype=ad] {display: none !important;}";
        },
        41: function () {
            // 收藏使用小帮助
            return "#pl_rightmod_helpfav {display: none !important;}";
        },
        42: function () {
            // 微博意见反馈
            return "#pl_rightmod_feedback {display: none !important;}";
        },
        43: function () {
            // 消息箱使用小帮助
            return "#Pl_Rightmod_Helpbox {display: none !important;}";
        },
        44: function () {
            // 微博桌面
            return "#pl_rightmod_weibodesk {display: none !important;}";
        },
        45: function () {
            // 发给我的使用小帮助
            return "#pl_rightmod_helptome {display: none !important;}";
        },
        46: function () {
            // @使用小帮助
            return "#pl_rightmod_helpat {display: none !important;}";
        },
        47: function () {
            // 评论使用小帮助
            return "#pl_rightmod_helpcomment {display: none !important;}";
        },
        48: function () {
            // 热评微博
            return "#pl_content_commentTopNav {display: none !important;}";
        },
        49: function () {
            // 微博举报处理中心
            return "#pl_rightmod_reportentry, #pl_common_reportentry {display: none !important;}";
        },
        50: function () {
            // 赞使用小帮助
            return "#pl_rightmod_helplike {display: none !important;}";
        },
        51: function () {
            // 私信使用小帮助
            return "#Pl_Rightmod_Littlehelp {display: none !important;}";
        },
        52: function () {
            // 留言箱使用小帮助
            return "#Pl_Rightmod_Helpnotebox {display: none !important;}";
        }
    };

    var Behavior = {
        0: function () {
            // 始终发布到公开
            Utils.trigger(document.querySelector("#pl_content_publisherTop a[node-type=showPublishTo]"), "click");
            // TODO: wait div.layer_menu_list[node-type=publishTo]
            Utils.trigger(document.querySelector("div.layer_menu_list a[suda-data*=edit_public]"), "click");
        },
        1: function () {
            // 无限滚动
            ".WB_feed .W_loading";
        },
        2: function () {
            // 根据“有 X 条新微博，点击查看”修改title
        }
    };

    ObjProxy.init();
    Utils.init();
    DOMObserver.init();

    var cssList = [],
        styleName = Utils.makeRandomStr(8);
    Array.prototype.forEach.call(Object.keys(UI), function (k) {
        cssList.push(UI[k]());
    });
    Utils.addNamedStyle(cssList.join(""), styleName);

})(this);