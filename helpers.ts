

export let $on = function (target: any, type: string, callback: any, useCapture?:boolean) {
    target.addEventListener(type, callback, !!useCapture);
}
