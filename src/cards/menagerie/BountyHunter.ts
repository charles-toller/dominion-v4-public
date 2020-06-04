import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class BountyHunter extends Card {
    intrinsicTypes = ["action"] as const;
    name = "bounty hunter";
    intrinsicCost = {
        coin: 4
    };
    cardText = "+1 Action\n" +
        "Exile a card from your hand. If you didn't have a copy of it in Exile, +$3.";
    supplyCount = 10;
    cardArt = "/img/card-img/Bounty_HunterArt.jpg";
    async onPlay(player: Player): Promise<void> {
        player.data.actions++;
        const card = await player.chooseCardFromHand(Texts.chooseCardToExileFor('bounty hunter'));
        if (card) {
            if (!player.data.exile.some((a) => a.name === card.name)) {
                await player.addMoney(3);
            }
            player.data.exile.push(card);
        }
    }
}
