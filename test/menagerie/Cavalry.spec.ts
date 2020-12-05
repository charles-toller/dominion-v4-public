import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('CAVALRY', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['cavalry']],
            d
        });
        player.testPlayAction('cavalry');
        player.onBuyPhaseStart(() => {
            expect(player.discardPile).to.have.members(['horse', 'horse']);
            done();
        });
        game.start();
    });
    it('reacts to gain', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['silver', 'silver', 'market', 'copper', 'copper', 'gold', 'gold']],
            activateCards: ['cavalry'],
            d
        });
        player.testPlayAction('No Card');
        player.testPlayTreasure('silver');
        player.testPlayTreasure('silver');
        player.testBuy('cavalry');
        player.testHookNextDecision(() => {
            expect(player.hand).to.have.members(['market', 'copper', 'copper', 'gold', 'gold']);
            expect(player.turnNumber).to.equal(1);
        });
        player.testPlayAction('market');
        // Cavalry is now in hand
        player.testPlayAction('No Card');
        player.onBuyPhaseStart(() => {
            expect(player.data.money).to.equal(1);
            expect(player.data.buys).to.equal(2);
            expect(player.data.actions).to.equal(1);
            expect(player.turnNumber).to.equal(1);
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['throne room', 'cavalry']],
            d
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, 'cavalry');
        player.onBuyPhaseStart(() => {
            expect(player.discardPile).to.have.members(['horse', 'horse', 'horse', 'horse']);
            done();
        });
        game.start();
    })
});
