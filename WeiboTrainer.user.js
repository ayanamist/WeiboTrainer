// ==UserScript==
// @name WeiboTrainer
// @namespace WeiboTrainer
// @author ayanamist
// @description Modify sina weibo web page.
// @match http://weibo.com/*
// @match http://account.weibo.com/*
// @version 1.0
// @run-at document-start
// @grant GM_addStyle
// ==/UserScript==

(function (window) {
    var document = window.document,
        Array = window.Array,
        CustomEvent = window.CustomEvent,
        Math = window.Math;

    var makeRandomStr = function (length) {
        var possibleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
            text = "",
            i = 0;
        for (; i < length; i += 1) {
            text += possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
        }
        return text;
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
        MSG_NAME: "wbtr_" + makeRandomStr(8),
        callbackNumPool: new NamePool("wbtrcb_"),
        delegateScript: function (msgName) {
            document.addEventListener(msgName, function (evt) {
                var objName = evt.detail.name,
                    callbackName = evt.detail.callbackName,
                    args = evt.detail.args,
                    names = objName.split("."),
                    i,
                    tmpObj,
                    value = null,
                    error = null;

                for (i = names[0] === "window" ? 1 : 0, tmpObj = window; i < names.length; i += 1) {
                    if (typeof tmpObj !== "undefined") {
                        tmpObj = tmpObj[names[i]];
                    }
                    else {
                        error = names.slice(0, i).join(".") + " does not exist!";
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
        remoteExecute: function (detail, callback) {
            if (typeof callback !== "undefined") {
                detail.callbackName = ObjProxy.callbackNumPool.borrow();
                var listener = document.addEventListener(detail.callbackName, function (evt) {
                    document.removeEventListener(detail.callbackName, listener);
                    console.log(evt.detail);
                    ObjProxy.callbackNumPool.pay(detail.callbackName);
                    if (detail.error !== null) {
                        callback(evt.detail.value);
                    }
                    else {
                        console.error(detail.error);
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
        getByName: function (objName, callback) {
            ObjProxy.remoteExecute({
                "name": objName
            }, callback);
        },
        callByName: function (funcName, args, callback) {
            if (!Array.isArray(args)) {
                args = typeof args === "undefined" ? [] : [args];
            }
            ObjProxy.remoteExecute({
                "name": funcName,
                "args": args
            }, callback);
        }
    };
    var Utils = {
        removeNodeBySelector: function (selector) {
            var nodes = document.querySelectorAll(selector),
                i = nodes.length - 1,
                node;
            for (; i >= 0; i -= 1) {
                node = nodes[i];
                node.parentNode.removeChild(node);
            }
        }
    };
    var Cleaner = {
        maybeInterested: function () {
            // 可能感兴趣的人
            return "#trustPagelet_recom_interestv5 {display: none !important;}";
        },
        layerTips: function () {
            // 浮动提示
            return ".layer_tips_intro {display: none !important;}";
        },
        bizTips: function () {
            // 时间线上面横幅广告
            ObjProxy.getByName("$CONFIG.uid", function (uid) {
                ObjProxy.callByName("STK.core.util.cookie.set", ["tips_" + uid, "1", {"expire": 36500}]);
            });
            return "#pl_content_biztips {display: none !important;}";
        },
        adActivity: function () {
            return "#pl_rightmod_ads35 {display: none !important;}";
        }
    };

    var script = document.createElement("script");
    script.innerHTML = "(" + ObjProxy.delegateScript.toString() + ")('" + ObjProxy.MSG_NAME + "');";
    document.getElementsByTagName("head")[0].appendChild(script);
    script = null;
    document.addEventListener("DOMContentLoaded", function() {
        Cleaner.bizTips();
    }, false);
})(window);