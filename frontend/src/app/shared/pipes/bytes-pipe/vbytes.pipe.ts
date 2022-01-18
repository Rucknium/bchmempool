/* tslint:disable */
import { Pipe, PipeTransform } from '@angular/core';
import { isNumberFinite, isPositive, isInteger, toDecimal } from './utils';

export type ByteUnit = 'vB' | 'kvB' | 'MvB' | 'GvB' | 'TvB';

@Pipe({
    name: 'Bytes'
})
export class BytesPipe implements PipeTransform {

    static formats: { [key: string]: { max: number, prev?: ByteUnit } } = {
        'vB': {max: 1000},
        'kvB': {max: Math.pow(1000, 2), prev: 'vB'},
        'MvB': {max: Math.pow(1000, 3), prev: 'kvB'},
        'GvB': {max: Math.pow(1000, 4), prev: 'MvB'},
        'TvB': {max: Number.MAX_SAFE_INTEGER, prev: 'GvB'}
    };

    transform(input: any, decimal: number = 0, from: ByteUnit = 'vB', to?: ByteUnit, plainText?: boolean): any {

        if (!(isNumberFinite(input) &&
                isNumberFinite(decimal) &&
                isInteger(decimal) &&
                isPositive(decimal))) {
            return input;
        }

        let bytes = input;
        let unit = from;
        while (unit !== 'vB') {
            bytes *= 1024;
            unit = BytesPipe.formats[unit].prev!;
        }

        if (to) {
            const format = BytesPipe.formats[to];

            const result = toDecimal(BytesPipe.calculateResult(format, bytes), decimal);

            return BytesPipe.formatResult(result, to, plainText);
        }

        for (const key in BytesPipe.formats) {
            const format = BytesPipe.formats[key];
            if (bytes < format.max) {

                const result = toDecimal(BytesPipe.calculateResult(format, bytes), decimal);

                return BytesPipe.formatResult(result, key, plainText);
            }
        }
    }

    static formatResult(result: number, unit: string, plainText: boolean): string {
        if(plainText){
            return `${result} ${unit}`;
        }
        return `${result} <span class="symbol">${unit}</span>`;
    }

    static calculateResult(format: { max: number, prev?: ByteUnit }, bytes: number) {
        const prev = format.prev ? BytesPipe.formats[format.prev] : undefined;
        return prev ? bytes / prev.max : bytes;
    }
}
