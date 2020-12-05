import {ESLintUtils} from '@typescript-eslint/experimental-utils';
const creator = ESLintUtils.RuleCreator((name) => `http://github.com/${name}`);
module.exports = creator({
    name: 'no-player-maps',
    meta: {
        docs: {
            category: "Best Practices" as const,
            description: '',
            recommended: 'error' as const
        },
        messages: {
            'player-type-in-map': 'Type player used as map key'
        },
        type: "problem",
        schema: {}
    },
    defaultOptions: [],
    create: (context) => {
        return {
            TSTypeReference(node) {
                if (node.typeName.type !== 'Identifier' || node.typeName.name !== 'Map') {
                    return;
                }
                if (!node.typeParameters || node.typeParameters.params.length < 2) {
                    return;
                }
                const firstType = node.typeParameters.params[0];
                if (firstType.type !== 'TSTypeReference' || firstType.typeName.type !== 'Identifier' || firstType.typeName.name !== 'Player') {
                    return;
                }
                context.report({
                    messageId: 'player-type-in-map',
                    loc: firstType.loc
                });
            },
            NewExpression(node) {
                if (node.callee.type !== 'Identifier' || node.callee.name !== 'Map') {
                    return;
                }
                if (!node.typeParameters || node.typeParameters.params.length < 2) {
                    return;
                }
                const firstType = node.typeParameters.params[0];
                if (firstType.type !== 'TSTypeReference' || firstType.typeName.type !== 'Identifier' || firstType.typeName.name !== 'Player') {
                    return;
                }
                context.report({
                    messageId: 'player-type-in-map',
                    loc: firstType.loc
                });
            }
        };
    }
});