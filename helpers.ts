declare var $on;

$on = function (target, type, callback, useCapture?) {
    target.addEventListener(type, callback, !!useCapture);
}
