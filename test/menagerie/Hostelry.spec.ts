import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('HOSTELRY', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['hostelry', 'copper', 'copper', 'copper', 'copper', 'silver', 'gold']],
            d
        });
        player.testPlayAction('hostelry');
        player.onBuyPhaseStart(() => {
            expect(player.hand).to.have.members(['copper', 'copper', 'copper', 'copper', 'silver']);
            expect(player.data.actions).to.equal(2);
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['throne room', 'hostelry', 'copper', 'copper', 'copper', 'silver', 'gold', 'gold']],
            d
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, 'hostelry');
        player.onBuyPhaseStart(() => {
            expect(player.hand).to.have.members(['copper', 'copper', 'copper', 'silver', 'gold']);
            expect(player.data.actions).to.equal(4);
            done();
        });
        game.start();
    });
    it('reacts to gain', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['silver', 'silver', 'copper', 'copper', 'copper']],
            activateCards: ['hostelry'],
            d
        });
        player.testPlayTreasure('silver');
        player.testPlayTreasure('silver');
        player.testBuy('hostelry');
        player.testChooseCard(Texts.discardAForBenefit('treasure', 1, 'gain a Horse'), 'copper');
        player.testChooseCard(Texts.discardAForBenefit('treasure', 1, 'gain a Horse'), 'copper');
        player.testHookNextDecision(() => {
            expect(player.discardPile).to.have.members(['hostelry', 'copper', 'copper', 'horse', 'horse']);
            expect(player.hand).to.have.members(['copper']);
        });
        player.testChooseCard(Texts.discardAForBenefit('treasure', 1, 'gain a Horse'), 'No Card');
        player.testEndGameNow();
        player.onScore(() => done());
        game.start();
    });
});
