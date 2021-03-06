import 'source-map-support/register';
import * as program from 'commander';
import {get} from "http";
import {createWriteStream, writeFileSync} from "fs";
import {basename, resolve} from "path";
import {HTMLElement, Node, parse} from "node-html-parser";
import {debug} from "webpack";
program.version('1.0.0');
program.option('-c, --card <card>', 'what card to fetch');
program.parse(process.argv);
if (typeof program.card === 'undefined') {
    console.error("Must choose a card!");
    process.exit(1);
}
async function fetchPage(page: string): Promise<string> {
    return new Promise((f) => {
        get('http://wiki.dominionstrategy.com' + page, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                f(data);
            });
        });
    });
}
async function downloadToPath(page: string, absPath: string): Promise<void> {
    return new Promise((f) => {
        const w = createWriteStream(absPath);
        get('http://wiki.dominionstrategy.com' + page, (res) => {
            res.on('data', d => w.write(d));
            res.on('end', () => {
                w.end();
                f();
            });
        });
    });
}
async function parsePage(p: string) {
    const page = parse(p);
    if (page instanceof HTMLElement) {
        const mainPage = page.querySelector("#mw-content-text");
        const info = {
            name: '',
            cost: {
                coin: 0
            },
            types: [] as string[],
            set: '',
            text: '',
            artwork: ''
        };
        const infoBox = mainPage.childNodes.find((a) => (a as HTMLElement).tagName === "table");
        if (!infoBox) {
            throw new Error("Bad page");
        }
        let nextCardText = false;
        infoBox.childNodes.forEach((a) => {
            const row = a as HTMLElement;
            if (row.tagName !== 'tr') return;
            if (onlyHTMLNode(row.childNodes)[0].innerHTML === 'Card text' || onlyHTMLNode(row.childNodes)[0].innerHTML === 'Event text' || onlyHTMLNode(row.childNodes)[0].innerHTML === 'Way text') {
                nextCardText = true;
                return;
            }
            if (nextCardText) {
                nextCardText = false;
                info.text = htmlToString(row.querySelector('td i'));
                return;
            }
            if (row.querySelector('.selflink')) {
                info.name = row.querySelector('.selflink').innerHTML.toLowerCase();
                return;
            }
            if (row.querySelector('.coin-icon')) {
                // Is it cost?
                if (row.childNodes.find((a) => a.childNodes.find((a) => (a as HTMLElement).attributes?.href === "/index.php/Cost") != null)) {
                    info.cost.coin = parseInt((/\$(\d*)/.exec(row.querySelector('img').attributes.alt) || ["", "0"])[1]);
                    return;
                }
                throw new Error("Unrecognized coin icon");
            }
            if (row.childNodes.find((a) => a.childNodes.find((b) => b.rawText === 'Set') != null)) {
                info.set = row.querySelector('a').innerHTML.toLowerCase().split(' ').map((a, i) => i === 0 ? a : a.slice(0, 1).toUpperCase() + a.slice(1)).join('');
            }
            const links = onlyHTMLNode(flattenChildren(row.childNodes), 'a');
            if (links.find((a) => a.attributes.href === "/index.php/Card_types") != null) {
                // Types array
                info.types = links.filter((a) => a.attributes.href !== "/index.php/Card_types").map((a) => a.innerHTML.toLowerCase());
            }
            if (links.find((a) => a.attributes.href === "/index.php/Expansions") != null) {
                info.set = links.find((a) => a.attributes.href !== "/index.php/Expansions")!.innerHTML.toLowerCase().split(' ').map((a, i) => i === 0 ? a : a.slice(0, 1).toUpperCase() + a.slice(1)).join('');
            }
        });
        const art = await fetchPage(`/index.php/File:${info.name.split(' ').map((a) => a.slice(0, 1).toUpperCase() + a.slice(1)).join("_")}Art.jpg`);
        const artPage = parse(art);
        const img = (artPage as HTMLElement).querySelector('a img') as HTMLElement;
        await downloadToPath(img.attributes.src, resolve(__dirname, "..", 'dist/img/card-img', basename(img.attributes.src)));
        info.artwork = `/img/card-img/${basename(img.attributes.src)}`;
        return info;
    }
}
function formatCardText(text: string): string {
    return text
        .replace(/<img [^>]*?alt="(\$\d*?)"[^>]*?>/g, (match, money) => money)
        .replace(/"/g, '\\"')
        .replace(/(\S)(\$\d+)/g, (match, pre, money) => pre + " " + money)
        .replace(/(\$\d+)([^\s,])/g, (match, money, post) => money + " " + post)
        .split('\n')
        .map((a, i, arr) => "\"" + a + (i + 1 === arr.length ? "" : "\\n") + "\"")
        .join(" +\n        ") + ";";
}
function infoToTemplate(info: {name: string; types: string[]; cost: {coin: number}; text: string; artwork: string}): string {
    let cardText = formatCardText(info.text);
    return (
        // eslint-disable-next-line @typescript-eslint/indent
`import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class ${info.name.split(' ').map((a) => a.slice(0, 1).toUpperCase() + a.slice(1)).join('')} extends Card {
    intrinsicTypes = ${JSON.stringify(info.types)} as const;
    name = "${info.name}";
    intrinsicCost = {
        coin: ${info.cost.coin}
    };
    cardText = ${cardText}
    supplyCount = 10;
    cardArt = "${info.artwork}";
    async onPlay(player: Player${info.types.includes("attack") ? ", exemptPlayers: Player[]" : ""}): Promise<void> {
        
    }
}
`
    // eslint-disable-next-line @typescript-eslint/indent
);
}
function infoToEventTemplate(info: {name: string; types: string[]; cost: {coin: number}; text: string; artwork: string}): string {
    let cardText = formatCardText(info.text);
    const oncePer = info.text.includes("Once per turn:") ? "\n    static oncePerTurn = true" : info.text.includes("Once per game:") ? "\n    static oncePerGame = true" : "";
    return (
        // eslint-disable-next-line @typescript-eslint/indent
`import type Player from "../../server/Player";
import Event from "../Event";
import {Texts} from "../../server/Texts";

export default class ${info.name.split(' ').map((a) => a.slice(0, 1).toUpperCase() + a.slice(1)).join('')} extends Event {
    cardArt = "${info.artwork}";
    cardText = ${cardText}
    intrinsicCost = {
        coin: ${info.cost.coin}
    };
    name = "${info.name}";${oncePer}
    async onPurchase(player: Player): Promise<any> {
        
    }
}`
    );
}
function infoToWayTemplate(info: {name: string; types: string[]; cost: {coin: number}; text: string; artwork: string}): string {
    let cardText = formatCardText(info.text);
    return (
`import type Player from "../../server/Player";
import Way from "../Way";
import type Tracker from "../../server/Tracker";
import type Card from "../Card";

export default class ${info.name.split(' ').map((a) => a.slice(0, 1).toUpperCase() + a.slice(1)).join('')} extends Way {
    cardArt = "${info.artwork}";
    cardText = ${cardText}
    name = "${info.name}";
    async onWay(player: Player, exemptPlayers: Player[], tracker: Tracker<Card>): Promise<void> {
        
    }
}`
    );
}
function infoToTest(info: {name: string; types: string[]; cost: {coin: number}; text: string; artwork: string}): string {
    return (
        // eslint-disable-next-line @typescript-eslint/indent
`import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('${info.name.toUpperCase()}', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['${info.name}']],
            d
        });
        player.testPlayAction('${info.name}');
        player.onBuyPhaseStart(() => {
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['throne room', '${info.name}']],
            d
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, '${info.name}');
        player.onBuyPhaseStart(() => {
            done();
        });
        game.start();
    })
});
`);
}
function infoToEventTest(info: {name: string; types: string[]; cost: {coin: number}; text: string; artwork: string}): string {
    return (
`import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('${info.name.toUpperCase()}', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [[]],
            activateCards: ['${info.name}'],
            d
        });
        player.testBuy('${info.name}');
        player.testHookEndTurn(() => {
            done();
        });
        game.start();
    });
});
`
    )
}
function infoToWayTest(info: {name: string; types: string[]; cost: {coin: number}; text: string; artwork: string}): string {
    return (
        `import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('${info.name.toUpperCase()}', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['smithy']],
            activateCards: ['${info.name}'],
            d
        });
        player.testPlayWay('${info.name}', 'smithy');
        player.onBuyPhaseStart(() => {
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['throne room', 'smithy']],
            activateCards: ['${info.name}'],
            d
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, 'smithy');
        player.testConfirmWay('${info.name}');
        player.testConfirmWay('${info.name}');
        player.onBuyPhaseStart(() => {
            done();
        });
        game.start();
    });
});
`
    )
}
function flattenChildren(children: Node[]): Node[] {
    return children.reduce((arr, node) => {
        return [...arr, node, ...flattenChildren(node.childNodes)];
    }, [] as Node[]);
}
function onlyHTMLNode(children: Node[], tagName?): HTMLElement[] {
    return children.filter((a) => {
        return (a as any).tagName && (typeof tagName === 'undefined' || (a as any).tagName === tagName);
    }) as any as HTMLElement[];
}
function htmlToString(node: HTMLElement): string {
    const nodes = flattenChildren(node.childNodes);
    let text = '';
    nodes.forEach((a) => {
        if ((a as HTMLElement).tagName === 'br') {
            text += '\n';
        }
        else if ((a as HTMLElement).childNodes.length === 1 && a.childNodes[0].nodeType === 3) {
            return;
        }
        else {
            text += ((a as HTMLElement).innerHTML || a.rawText).replace(/\n/g, '').split(' ').filter((a) => a !== '').join(' ');
        }
    });
    return text;
}
let cardPathPart;
if (program.card.startsWith("way of the")) {
    cardPathPart = "Way_of_the_" + program.card.split(" ")[3].slice(0, 1).toUpperCase() + program.card.split(" ")[3].slice(1);
}
else {
    cardPathPart = program.card.split(' ').map((a) => a.slice(0, 1).toUpperCase() + a.slice(1)).join('_');
}
fetchPage(`/index.php/${cardPathPart}`).then((page) => {
    parsePage(page).then((a) => {
        if (a) {
            const klass = a.types.includes("event") ? infoToEventTemplate(a) : a.types.includes("way") ? infoToWayTemplate(a) : infoToTemplate(a);
            const filename = a.name.split(' ').map((a) => a.slice(0, 1).toUpperCase() + a.slice(1)).join('');
            writeFileSync(resolve(__dirname, "..", "src/cards", a.set, filename + ".ts"), klass);
            const test = a.types.includes("event") ? infoToEventTest(a) : a.types.includes("way") ? infoToWayTest(a) : infoToTest(a);
            writeFileSync(resolve(__dirname, "..", "test", a.set, filename + ".spec.ts"), test);
        }
    });
});
