import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('SNOWY VILLAGE', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['snowy village', 'village', 'copper', 'copper', 'copper', 'silver', 'silver', 'gold']],
            d
        });
        player.testPlayAction('snowy village');
        player.testPlayAction('village');
        player.onBuyPhaseStart(() => {
            expect(player.hand).to.have.members(['copper', 'copper', 'copper', 'silver', 'silver']);
            expect(player.data.actions).to.equal(3);
            expect(player.data.buys).to.equal(2);
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['throne room', 'snowy village', 'copper', 'copper', 'copper', 'silver', 'silver', 'gold']],
            d
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, 'snowy village');
        player.onBuyPhaseStart(() => {
            expect(player.hand).to.have.members(['copper', 'copper', 'copper', 'silver', 'silver']);
            expect(player.data.actions).to.equal(4);
            expect(player.data.buys).to.equal(3);
            done();
        });
        game.start();
    })
});
