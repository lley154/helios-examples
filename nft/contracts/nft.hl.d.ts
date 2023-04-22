import * as helios from "@hyperionbt/helios"

declare class Program {
    constructor(parameters?: {[name: string]: helios.HeliosData | any});

    get name(): string;
    get paramTypes(): {[name: string]: helios.Type};
    get parameters(): {[name: string]: helios.HeliosData};
    get types(): {[typeName: string]: {new(...any): helios.HeliosData}};

    set parameters(params: {[name: string]: helios.HeliosData | any});

    compile(optimize?: boolean): helios.UplcProgram;
    evalParam(paramName: string): helios.UplcValue;
}

export default Program
