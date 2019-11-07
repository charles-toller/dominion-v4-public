import * as React from 'react';
import getColorForButton from "./getColorForButton";
import {ValidCardTypes} from "../cards/Card";
interface IProps {
    cardName: string;
    id: string;
    types: readonly ValidCardTypes[];
    onClick: (cardName: string) => any;
    onHover: (cardName: string) => any;
}
export default function HandButton(props: IProps) {
    return (
        <button
            className={"btn btn-"+getColorForButton(props.types)}
            id={props.id}
            onClick={() => props.onClick(props.cardName)}
            onMouseEnter={() => props.onHover(props.cardName)}
            style={{fontFamily:"TrajanPro-Bold",fontSize:'20px', padding: `4px 12px 4px 12px`, display: 'block', margin: '4px 0'}}>
            {props.cardName}
        </button>
    );
}