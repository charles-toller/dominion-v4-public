import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('GROOM', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['groom']],
            d
        });
        player.testPlayAction('groom');
        player.testGain('groom', 'silver');
        player.onBuyPhaseStart(() => {
            expect(player.discardPile).to.have.members(['silver', 'silver']);
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['throne room', 'groom', 'copper', 'copper', 'copper', 'silver']],
            d
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, 'groom');
        player.testGain('groom', 'groom');
        player.testGain('groom', 'estate');
        player.onBuyPhaseStart(() => {
            expect(player.discardPile).to.have.members(['horse', 'groom', 'estate']);
            expect(player.hand).to.have.members(['copper', 'copper', 'copper', 'silver']);
            expect(player.data.actions).to.equal(1);
            done();
        });
        game.start();
    })
});
