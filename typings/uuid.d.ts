declare module "uuid/v4" {

    interface Options {
        random: number[];
    }

    const uuid: (options?: Options) => string;
    export = uuid;
}