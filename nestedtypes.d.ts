declare module "nestedtypes" {           
    type TModel<T, TCol> = T & Model<T, TCol>;
    type TCollection<T, TCol> = TCol & {
            new(),
            reset(),
            get(id): TModel<T, TCol>,
            filter(pred): TModel<T, TCol>[]
        }

    interface Model<T, TCol> {
        new (v: T);
        readonly cid: any;
        readonly Collection: TCollection<T, TCol>
    }

    export var Model: {
        extend<T, TCol>(params:{defaults:T, collection?:TCol}): TModel<T, TCol>;
        }
}

interface NumberConstructor {
    value(v: any): Number
}