import nlp = require('compromise');
import type Card from "./cards/Card";
import type Tracker from "./server/Tracker";
export default class Util {
    static checkTrashSanity(selected: Card, choices: Card[]) {
        return !(selected.cost.coin > 2 && choices.find((a) => selected.cost.coin > a.cost.coin) != null);
    }
    static filterAndExerciseTrackers(trackers: Array<Tracker<Card>>): Card[] {
        return trackers.filter((a) => a.hasTrack).map((a) => a.exercise()!);
    }
    static formatTrackerList(trackers: Array<Tracker<Card>>): string {
        return Util.formatCardList(trackers.map((a) => a.viewCard().name));
    }
    static formatCardList(cards: Array<Card | string>): string {
        const cardStrings = cards.map((a) => typeof a === 'string' ? a : a.name) as string[];
        const formattedCards = cardStrings.map((a, i) => {
            if (cardStrings.indexOf(a) !== i) {
                return undefined;
            }
            const count = cardStrings.filter((b) => a === b).length;
            if (count === 1) {
                return this.article(a) + ' ' + a;
            }
            return this.numeral(count) + ' ' + this.plural(a);
        }).filter((a) => a != null) as string[];
        if (formattedCards.length === 0) {
            return 'nothing';
        }
        if (formattedCards.length === 1) {
            return formattedCards[0];
        }
        if (formattedCards.length === 2) {
            return `${formattedCards[0]} and ${formattedCards[1]}`;
        }
        return formattedCards.slice(0, -1).join(', ') + ', and ' + formattedCards.slice(-1)[0];
    }
    static parseCardList(list: string): string[] {
        const cards: string[] = [];
        let match: RegExpExecArray | null;
        const reg = /(\S*)\s*([^,\s]*),?\s*(?:and)?\s*/g;
        while ((match = reg.exec(list)) != null && match[0] !== '') {
            const [, quantity, card] = match;
            const numQuantity = this.unnumeral(quantity);
            const singular = this.unpluralize(card);
            for (let i = 0; i < numQuantity; i++) {
                cards.push(singular);
            }
        }
        return cards;
    }
    private static articleCache: {[word: string]: string | undefined} = {};
    static article(card: string): string {
        if (!this.articleCache[card]) {
            this.articleCache[card] = nlp('the nice ' + card).tag('Noun').nouns().list[0].article().trim();
        }
        return this.articleCache[card]!;
    }
    private static pluralCache: {[word: string]: string | undefined} = {};
    static plural(card: string): string {
        if (!this.pluralCache[card]) {
            this.pluralCache[card] = nlp(card).tag('Noun').nouns().list[0].toPlural().out('text').trim();
        }
        return this.pluralCache[card]!;
    }
    private static numberCache: {[number: number]: string | undefined} = {
        // Guess what? nlp doesn't recognize 0, so we get to do this. Works the other way around.
        0: "zero"
    };
    static numeral(number: number): string {
        if (!this.numberCache[number]) {
            this.numberCache[number] = nlp(number + '').values().list[0].toText().out('text').trim();
        }
        return this.numberCache[number]!;
    }
    static unnumeral(number: string): number {
        if (number === 'a') return 1;
        const num = nlp(number).values(0).toNumber().out();
        if (num === "") {
            return Number.NEGATIVE_INFINITY;
        }
        return num;
    }
    static unpluralize(card: string): string {
        return Object.entries(this.pluralCache).find(([key, value]) => key === card || value === card)![0];
    }
    static nonNull<T>(item: T | null | undefined): item is T {
        return item != null;
    }
    static wait(time: number): Promise<void> {
        return new Promise((f) => {
            if (process.env.SKIP_WAITS === 'true') {
                f();
            }
            else {
                setTimeout(f, time);
            }
        });
    }
    static deduplicateByName(list: Card[]): Card[] {
        return list.filter((a, i) => list.findIndex((b) => b.name === a.name) === i);
    }
}