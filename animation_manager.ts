

export default class AnimationManager {
    ticker = new PIXI.ticker.Ticker();

    constructor(
            private render_cb: ()=>void // function to do rendering
        ) {
        let self = this;
        this.ticker.autoStart = true; 

        // Patching ticker.update to do rendering after all animation changes
        (function patch_ticker(f: (...args)=>void){
            self.ticker.update = function(...args) {		
                f(...args);		
                self.render_cb();
            }
        })(this.ticker.update.bind(this.ticker));
    }

    // obj[prop] will change from start_v to start_v + d_v 
    // using specified easing function
    animate(conf: {
        obj: any,
        prop: string,
        start_v: number,
        d_v: number,
        easing: (t,b,c,d) => number,
        duration: number
    }) {
        let self = this;
        conf.obj.__animations = conf.obj.__animations || {};

        // TODO: remove generator function to make code es5 targetable
        conf.obj.__animations[conf.prop] = (function*() {
                let time = 0;			
                while (time < conf.duration) {
                    let dt = yield null;
                    time += dt;				
                    let new_v = conf.easing(time, conf.start_v, conf.d_v, conf.duration);				
                    conf.obj[conf.prop] = new_v;				
                }
            })();

        conf.obj[conf.prop] = conf.start_v;

        this.ticker.add(tick);

        function tick(dt) {
            let done = true;
            let anim = conf.obj.__animations[conf.prop];
            if (anim) {
                done = anim.next(dt).done;
            }

            if (done) {
                self.ticker.remove(tick);
            }
        }	
    }
}