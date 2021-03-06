/**
 * Created by mt on 21/12/2015.
 */

var Utils = require('../Utils');

/**
 * Rule in the form subClassOf(a, b) ^ subClassOf(b, c) -> subClassOf(a, c)
 * i.e. conjunction of facts
 * @param slf set of (left side) conjunctive facts
 * @param ra the consequence facts
 * @constructor
 */
Rule = function(slf, srf) {
    this.causes = slf;
    this.consequences = srf;
    this.constants = [];
    for (var i = 0; i < slf.length; i++) {
        this.constants = Utils.uniques(this.constants, slf[i].constants);
    }
    for (var i = 0; i < srf.length; i++) {
        this.constants = Utils.uniques(this.constants, srf[i].constants);
    }
};

Rule.prototype = {
    /**
     * Convenient method to stringify a rule.
     * @returns {string}
     */
    toString: function() {
        var factConj = '';
        for(var key in this.causes) {
            factConj += ' ^ ' + this.causes[key].toString();
        }
        return factConj.substr(3) + ' -> ' + this.consequences.toString();
    },

    /**
     * Orders rule causes (inplace) from the most to the least restrictive.
     * The least a cause have variables, the most it is restrictive.
     */
    orderCausesByMostRestrictive: function() {
        var orderedCauses = [],
            totalConstantOccurences = [];

        for (var i = 0; i < this.causes.length; i++) {
            var cause = this.causes[i],
                constantOccurences = 0;
            if (!(cause.subject.indexOf('?') === 0)) {
                constantOccurences++;
            }
            if (!(cause.predicate.indexOf('?') === 0)) {
                constantOccurences++;
            }
            if (!(cause.object.indexOf('?') === 0)) {
                constantOccurences++;
            }
            totalConstantOccurences.push({
                cause: cause,
                constantOccurences: constantOccurences
            });
        }

        totalConstantOccurences = totalConstantOccurences.sort(function(a, b) {
            var x = a.constantOccurences; var y = b.constantOccurences;
            return ((x > y) ? -1 : ((x < y) ? 1 : 0));
        });

        for(var i = 0; i < totalConstantOccurences.length; i++) {
            orderedCauses.push(totalConstantOccurences[i].cause);
        }

        this.causes = orderedCauses;
    },

    addCause: function(cause) {
        var newRule = new Rule(this.causes.concat([cause]), this.consequences);
        this.causes = newRule.causes;
        this.consequences = newRule.consequences;
        this.constants = newRule.constants;
    },

    addConsequence: function(cons) {
        var newRule = new Rule(this.causes, this.consequences.concat([cons]));
        this.causes = newRule.causes;
        this.consequences = newRule.consequences;
        this.constants = newRule.constants;
    },


    // @todo
    getIdbPredicates: function() {

    },

    // @todo
    getEdbPredicates: function() {

    }
};

module.exports = Rule;