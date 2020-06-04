import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('CARDINAL', () => {
    it('works normally', (d) => {
        const [game, [player, q], done] = makeTestGame({
            decks: [['cardinal'], ['copper', 'copper', 'copper', 'copper', 'copper', 'silver', 'gold']],
            d,
            players: 2
        });
        player.testPlayAction('cardinal');
        q.testChooseCard(Texts.chooseCardToExileFor('cardinal'), 'gold');
        player.onBuyPhaseStart(() => {
            expect(player.data.money).to.equal(2);
            expect(q.discardPile).to.have.members(['silver']);
            expect(q.exile).to.have.members(['gold']);
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player, q], done] = makeTestGame({
            decks: [['throne room', 'cardinal'], ['copper', 'copper', 'copper', 'copper', 'copper', 'copper', 'silver', 'gold', 'gold']],
            d,
            players: 2
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, 'cardinal');
        q.testChooseCard(Texts.chooseCardToExileFor('cardinal'), 'gold');
        player.onBuyPhaseStart(() => {
            expect(player.data.money).to.equal(4);
            expect(q.discardPile).to.have.members(['copper', 'gold']);
            expect(q.exile).to.have.members(['silver', 'gold']);
            done();
        });
        game.start();
    })
});
