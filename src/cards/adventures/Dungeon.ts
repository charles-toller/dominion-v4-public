import Card from "../Card";
import Player from "../../server/Player";
import {Texts} from "../../server/Texts";

export default class Dungeon extends Card {
    intrinsicTypes = ["action","duration"] as const;
    name = "dungeon";
    intrinsicCost = {
        coin: 3
    };
    cardText = "+1 Action\n" +
        "Now and at the start of your next turn: +2 Cards, then discard 2 cards.";
    supplyCount = 10;
    cardArt = "/img/card-img/800px-DungeonArt.jpg";
    private isNextTurn = false;
    async doEffect(player: Player) {
        player.data.actions++;
        await player.draw(2);
        let card = await player.chooseCardFromHand(Texts.chooseCardToDiscardFor('dungeon'));
        if (card) {
            await player.discard(card);
            card = await player.chooseCardFromHand(Texts.chooseCardToDiscardFor('dungeon'));
            if (card) {
                await player.discard(card);
            }
        }
        player.effects.setupEffect('turnStart', 'dungeon', {}, async () => {
            this.isNextTurn = true;
            await this.doEffect(player);
        });
        this.isNextTurn = false;
    }

    shouldDiscardFromPlay(): boolean {
        return this.isNextTurn;
    }

    async onAction(player: Player): Promise<void> {
        await this.doEffect(player);
    }
}
