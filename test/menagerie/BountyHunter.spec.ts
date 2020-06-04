import makeTestGame from "../testBed";
import { expect } from 'chai';
import {Texts} from "../../src/server/Texts";

describe('BOUNTY HUNTER', () => {
    it('works normally', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['bounty hunter', 'copper', 'silver']],
            d
        });
        player.testPlayAction('bounty hunter');
        player.testChooseCard(Texts.chooseCardToExileFor('bounty hunter'), 'copper');
        player.onBuyPhaseStart(() => {
            expect(player.exile).to.have.members(['copper']);
            expect(player.data.money).to.equal(3);
            done();
        });
        game.start();
    });
    it('can be throne roomed', (d) => {
        const [game, [player], done] = makeTestGame({
            decks: [['throne room', 'bounty hunter', 'copper', 'copper', 'silver']],
            d
        });
        player.testPlayAction('throne room');
        player.testChooseCard(Texts.chooseCardToPlayTwice, 'bounty hunter');
        player.testChooseCard(Texts.chooseCardToExileFor('bounty hunter'), 'copper');
        player.testChooseCard(Texts.chooseCardToExileFor('bounty hunter'), 'copper');
        player.onBuyPhaseStart(() => {
            expect(player.exile).to.have.members(['copper', 'copper']);
            expect(player.data.money).to.equal(3);
            done();
        });
        game.start();
    })
});
