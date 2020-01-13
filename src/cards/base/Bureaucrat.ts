import Card from "../Card";
import Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import Util from "../../Util";

export default class Bureaucrat extends Card {
    intrinsicTypes = ["action","attack"] as const;
    name = "bureaucrat";
    intrinsicCost = {
        coin: 4
    };
    cardText = "Gain a Silver onto your deck. Each other player reveals a Victory card from their hand and puts it onto their deck (or reveals a hand with no Victory cards).";
    supplyCount = 10;
    cardArt = "/img/card-img/BureaucratArt.jpg";
    async onAction(player: Player, exemptPlayers: Player[]): Promise<void> {
        await player.gain('silver', undefined, true, 'deck');
        await player.attackOthersInOrder(exemptPlayers, async (p) => {
            const card = await p.chooseCardFromHand(Texts.chooseVictoryToTopDeckFor('bureaucrat'), false, (card) => card.types.includes("victory"));
            if (card) {
                if ((await p.reveal([card])).length !== 0) {
                    p.lm('%p puts %ac on top of their deck.', Util.formatCardList([card.name]));
                    p.deck.cards.unshift(card);
                }
            }
            else {
                await p.reveal(p.data.hand);
            }
        });
    }
}
