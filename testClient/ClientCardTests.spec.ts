import type {Server} from "socket.io";
import type {Server as HttpServer} from 'http';
import ClientTestPlayer, {ClientTestGame, setupClientTestBed} from "./testBed";
import {Builder, By, WebDriver} from "selenium-webdriver";
import type {EventEmitter} from "events";
import type {Decision, DecisionResponseType} from "../src/server/Decision";
import {readdirSync} from "fs";
import {resolve} from "path";
import {Interrupt} from "./Interrupt";
import {Options} from "selenium-webdriver/chrome";
function decisionIsType<T extends keyof DecisionResponseType>(type: T, response: any): asserts response is DecisionResponseType[T] {}
function assertNever(a: never) {}
function supplyButton(name: string) {
    return `//div[@id="supplyGroup"]/button[text()="${name}"]`;
}
function handButton(id: string) {
    return `//div[@id="handGroup"]/descendant::button[@id="${id}"]`;
}
describe('CLIENT CARDS', () => {
    let server: Server;
    let driver: WebDriver;
    let driver2: WebDriver;
    let driver3: WebDriver;
    let events: EventEmitter;
    let currentGame: ClientTestGame;
    async function setupResponder(driver: WebDriver, playerIndex: number) {
        let id = currentGame.id;
        while (!currentGame.ended && currentGame.id === id) {
            const decision: Decision = await driver.executeAsyncScript(function (callback) {
                // @ts-ignore
                if (window.dominionDecision != null) {
                    // @ts-ignore
                    callback(window.dominionDecision);
                    // @ts-ignore
                    window.dominionDecision = null;
                    return;
                }
                let responded = false;
                let timeout;
                function d(decision) {
                    if (timeout) window.clearTimeout(timeout);
                    // @ts-ignore
                    callback(decision.detail);
                    // @ts-ignore
                    window.dominionDecision = null;
                    window.removeEventListener('dominionDecision', d);
                }
                window.addEventListener('dominionDecision', d);
                timeout = window.setTimeout(() => {
                    window.removeEventListener('dominionDecision', d);
                    callback(null);
                }, 500);
            });
            if (decision == null) {
                continue;
            }
            const p = currentGame.players[playerIndex] as ClientTestPlayer;
            let response;
            try {
                response = await p.getDecisionResponse(decision);
            }
            catch (e) {
                p.rejectDecisionPromise?.(e);
            }
            if (response instanceof Interrupt) {
                console.log("INTERRUPT");
                switch (response.type) {
                    case "reserve":
                        await driver.findElement(By.id(response.data.cardId)).click();
                        break;
                }
                continue;
            }
            console.log(`responding with: ${JSON.stringify(response)}`);
            try {
                switch (decision.decision) {
                    case "confirm":
                        decisionIsType(decision.decision, response);
                        if (response) {
                            await driver.findElement(By.xpath('//button[text()="Yes"]')).click();
                        } else {
                            await driver.findElement(By.xpath('//button[text()="No"]')).click();
                        }
                        break;
                    case "chooseCardOrBuy":
                        decisionIsType(decision.decision, response);
                        if (response.choice.name === "End Turn") {
                            await driver.findElement(By.xpath('//button[text()="End Turn"]')).click();
                        }
                        else if (response.responseType === "playCard") {
                            await driver.findElement(By.xpath(handButton(response.choice.id))).click();
                        }
                        else {
                            await driver.findElement(By.xpath(supplyButton(response.choice.name))).click();
                        }
                        break;
                    case "buy":
                        decisionIsType(decision.decision, response);
                        if (response.choice.name === "End Turn") {
                            await driver.findElement(By.xpath('//button[text()="End Turn"]')).click();
                        }
                        else {
                            await driver.findElement(By.xpath(supplyButton(response.choice.name))).click();
                        }
                        break;
                    case "chooseCard":
                        decisionIsType(decision.decision, response);
                        await driver.findElement(By.xpath(handButton(response.id))).click();
                        break;
                    case "chooseOption":
                        decisionIsType(decision.decision, response);
                        await driver.findElement(By.xpath(`//div[@id="handGroup"]/descendant::button[text()="${response.choice}"]`)).click();
                        break;
                    case "gain":
                        decisionIsType(decision.decision, response);
                        await driver.findElement(By.xpath(supplyButton(response.name))).click();
                        break;
                    case "reorder":
                        decisionIsType(decision.decision, response);
                        await driver.findElement(By.xpath('//button[text()="Done"]')).click();
                        break;
                    case "chooseUsername":
                        decisionIsType(decision.decision, response);
                        await driver.findElement(By.xpath('//input')).sendKeys(p.username);
                        await driver.findElement(By.xpath('//button[text()="Submit"]')).click();
                        break;
                    default:
                        assertNever(decision);
                        break;
                }
            }
            catch (e) {
                console.error(e);
            }
        }
    }
    let httpServer: HttpServer;
    before(async () => {
        process.env.PORT = "4000";
        process.env.NODE_ENV = '';
        process.env.SKIP_WAITS = 'true';
        process.env.FORCE_COLONY = 'true';
        let serve = require(__dirname + "/../src/server/app.js");
        server = serve.sockets;
        httpServer = serve.server;
        events = setupClientTestBed(server);
        driver = await new Builder().forBrowser('chrome').setChromeOptions(new Options().addArguments('--mute-audio')).build();
        driver2 = await new Builder().forBrowser('chrome').setChromeOptions(new Options().addArguments('--mute-audio')).build();
        driver3 = await new Builder().forBrowser('chrome').setChromeOptions(new Options().addArguments('--mute-audio')).build();
        events.on('newGame', async (game: ClientTestGame) => {
            console.log("game created!");
            currentGame = game;
        });
        events.on('playerCount', async (players) => {
            console.log(`player count: ${players}`);
            for (let i = 0; i < players; i++) {
                const c = [driver, driver2, driver3][i];
                await c.navigate().to('http://localhost:4000');
                await c.executeScript(`window.sessionStorage.setItem("game:${currentGame.id}", "${currentGame.players[i].id}")`);
                await c.navigate().to(`http://localhost:4000/game/${currentGame.id}`);
                await c.executeScript('window.dominionNoPrompts = true;');
                setupResponder(c, i);
            }
            /*for (let i = 1; i < players; i++) {
                (i === 1 ? driver2 : driver3).navigate().to(`http://localhost:4000/game/${gameId}`);
                setupResponder(i === 1 ? driver2 : driver3, i);
            }*/
        });
    });
    afterEach(async () => {
        await new Promise((f) => setTimeout(f, 50));
    });
    after(async () => {
        httpServer.close();
        await driver.close();
        await driver2.close();
        await driver3.close();
    });
    const dir = readdirSync(resolve(__dirname, "../test"), {
        withFileTypes: true
    });
    dir.filter((a) => a.isDirectory()).forEach((box) => {
        describe(box.name.replace(/([A-Z])/g, " $1").toUpperCase(), () => {
            const cards = readdirSync(resolve(__dirname, "../test", box.name));
            cards.filter((a) => /.*\.spec\.js$/.test(a)).forEach((card) => {
                require(resolve(__dirname, "../test", box.name, card));
            });
        });
    });
});