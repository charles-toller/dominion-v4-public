import Card from "../Card";
import type Player from "../../server/Player";
import {Texts} from "../../server/Texts";
import type CardHolder from "../../server/CardHolder";

export default class Research extends Card {
    static descriptionSize = 56;
    static typelineSize = 63;
    intrinsicTypes = ["action","duration"] as const;
    name = "research";
    intrinsicCost = {
        coin: 4
    };
    cardText = "+1 Action\n" +
        "Trash a card from your hand. Per $1 it costs, set aside a card from your deck face down (on this). At the start of your next turn, put those cards into your hand.";
    supplyCount = 10;
    cardArt = "/img/card-img/ResearchArt.jpg";
    cards: CardHolder | null = null;
    async onPlay(player: Player): Promise<void> {
        player.data.actions++;
        const card = await player.chooseCardFromHand(Texts.chooseCardToTrashFor('research'));
        if (card) {
            if (this.cards == null) {
                this.cards = this.game.getCardHolder(player);
            }
            await player.trash(card);
            const cost = card.cost.coin;
            for (let i = 0; i < cost; i++) {
                const card = await player.deck.pop();
                if (card === undefined) break;
                this.cards.addCard(card);
            }
        }
        player.effects.setupEffect('turnStart', 'research', {
            compatibility: {}
        }, async (remove) => {
            player.lm('%p takes the set aside cards for research.');
            while (this.cards?.getCards().length) {
                const card = this.cards.popCard()!;
                player.data.hand.push(card);
            }
            remove();
        });
    }
    shouldDiscardFromPlay(): boolean {
        return !!this.cards?.getCards().length;
    }
}
