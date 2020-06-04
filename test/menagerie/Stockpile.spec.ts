import makeTestGame from "../testBed";
import { expect } from 'chai';

describe('STOCKPILE', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['stockpile']],
            d
        });
        player.testPlayTreasure('stockpile');
        player.onBuyPhaseStart(() => {
            expect(player.data.money).to.equal(3);
            expect(player.data.buys).to.equal(2);
            expect(player.allCardsTest).to.have.members(['stockpile']);
            expect(player.playArea).to.be.empty;
            done();
        });
        game.start();
    });
});
