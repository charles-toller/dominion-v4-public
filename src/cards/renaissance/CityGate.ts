import Project from "../Project";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import Util from "../../Util";

export default class CityGate extends Project {
    cardArt = "/img/card-img/City_GateArt.jpg";
    cardText = "At the start of your turn,\n" +
        "+1 Card,\n" +
        "then put a card from your hand onto your deck.";
    intrinsicCost = {
        coin: 3
    };
    name = "city gate";
    async onPlayerJoinProject(player: Player): Promise<any> {
        player.effects.setupEffect('turnStart', 'city gate', {
            compatibility: {}
        }, async () => {
            player.lm('The city gate activates for %p.');
            await player.draw(1, true);
            const card = await player.chooseCardFromHand(Texts.chooseCardToPutOnDeck);
            if (card) {
                player.lm('%p topdecks %s.', Util.formatCardList([card.name]));
                player.deck.cards.unshift(card);
            }
        });
    }
}