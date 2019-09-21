import Card from "../Card";
import Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class Villain extends Card {
    types = ["action","attack"] as const;
    name = "villain";
    cost = {
        coin: 5
    };
    cardText = "+2 Coffers\n" +
        "Each other player with 5 or more cards in hand discards one costing $2 or more (or reveals they can't).";
    supplyCount = 10;
    features = ["coffers"] as const;
    cardArt = "/img/card-img/VillainArt.jpg";
    async onAction(player: Player, exemptPlayers: Player[]): Promise<void> {
        player.data.coffers += 2;
        await player.attackOthers(exemptPlayers, async (p) => {
            if (p.data.hand.some((a) => player.game.getCostOfCard(a.name).coin >= 2)) {
                const card = await p.chooseCard(Texts.chooseCardToDiscardFor('villain'), p.data.hand.filter((a) => p.game.getCostOfCard(a.name).coin >= 2));
                if (card) {
                    p.data.hand.splice(p.data.hand.findIndex((a) => a.id === card.id), 1);
                    await p.discard(card, true);
                }
            }
            else {
                p.lm('%p has no cards costing $2 or more.');
                await p.reveal(p.data.hand);
            }
        });
    }
}