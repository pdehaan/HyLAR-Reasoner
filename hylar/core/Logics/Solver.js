/**
 * Created by pc on 27/01/2016.
 */

var Fact = require('./Fact');
var Logics = require('./Logics');
var Utils = require('../Utils');
var AnnotatedQuery = require('./AnnotatedQuery');

/**
 * Core solver used to evaluate rules against facts
 * using pattern matching mechanisms.
 */

Solver = {

    /**
     * Evaluates a set of rules over a set of facts.
     * @param rs
     * @param facts
     * @returns Array of the evaluation.
     */
    evaluateRuleSet: function(rs, facts, doTagging, resolvedImplicitFactSet) {
        var newCons, cons = [];
        for (var key in rs) {
            if (doTagging) {
                newCons = this.evaluateThroughRestrictionWithTagging(rs[key], facts, resolvedImplicitFactSet);
                cons = cons.concat(newCons);
            } else {
                newCons = this.evaluateThroughRestriction(rs[key], facts);
                cons = Utils.uniques(cons, newCons);
            }
        }
        return cons;
    },

    /**
     * Evaluates a rule over a set of facts through
     * restriction of the rule's causes.
     * @param rule
     * @param facts
     * @returns {Array}
     */
    evaluateThroughRestriction: function(rule, facts) {
        var mappingList = this.getMappings(rule, facts),
            consequences = [];

        for (var i = 0; i < mappingList.length; i++) {
            // Replace mappings on all consequences
            for (var j = 0; j < rule.consequences.length; j++) {
                consequences.push(this.substituteFactVariables(mappingList[i], rule.consequences[j], []));
            }
        }

        return consequences;
    },

    /**
     * Evaluates a rule over a set of facts through
     * restriction of the rule's causes with tagging.
     * @param rule
     * @param kb
     * @returns {Array}
     */
    evaluateThroughRestrictionWithTagging: function(rule, kb) {
        var mappingList = this.getMappings(rule, kb),
            consequences = [], consequence, causes, implicitCauses;

        for (var i = 0; i < mappingList.length; i++) {
            // Replace mappings on all consequences
            causes = Logics.buildCauses(mappingList[i].__facts__);
            // Retrieves implicit causes
            implicitCauses = Logics.getOnlyImplicitFacts(mappingList[i].__facts__);
            for (var j = 0; j < rule.consequences.length; j++) {
                consequence = this.substituteFactVariables(mappingList[i], rule.consequences[j], causes, implicitCauses);
                //if (Logics.filterKnownOrAlternativeImplicitFact(consequence, kb, resolvedImplicitFacts)) {
                    consequences.push(consequence);
                //}
            }
        }

        return consequences;
    },

    getMappings: function(rule, facts) {
        var i = 0, mappingList;

        rule.orderCausesByMostRestrictive();
        mappingList = [rule.causes[i]]; // Init with first cause

        while (i < rule.causes.length) {
            mappingList = this.substituteNextCauses(mappingList, rule.causes[i+1], facts, rule.constants);
            i++;
        }
        return mappingList;
    },

    /**
     * Updates the mapping of the current cause
     * given the next cause of a rule, over a
     * set of facts.
     * @param currentCauses
     * @param nextCause
     * @param facts
     * @returns {Array}
     */
    substituteNextCauses: function(currentCauses, nextCause, facts, constants) {
        var substitutedNextCauses = [],
            mappings = [];

        for (var i = 0; i < currentCauses.length; i++) {

            for (var j = 0; j < facts.length; j++) {

                // Get the mapping of the current cause ...
                var mapping = currentCauses[i].mapping,
                    substitutedNextCause,
                    newMapping;
                // ... or build a fresh one if it does not exist
                if (mapping === undefined) {
                    mapping = {};
                    mapping.__facts__ = [];
                }

                // Update the mapping using pattern matching
                newMapping = this.factMatches(facts[j], currentCauses[i], mapping, constants);

                // If the current fact matches the current cause ...
                if (newMapping) {
                    // If there are other causes to be checked...
                    if (nextCause) {
                        // Substitute the next cause's variable with the new mapping
                        substitutedNextCause = this.substituteFactVariables(newMapping, nextCause);
                        substitutedNextCause.mapping = newMapping;
                        substitutedNextCauses.push(substitutedNextCause);
                    } else {
                        // Otherwise, add the new mapping to the global mapping array
                        mappings.push(newMapping);
                    }
                }
            }
        }

        if(nextCause) {
            return substitutedNextCauses;
        } else {
            return mappings;
        }
    },

    /**
     * Returns a new or updated mapping if a fact matches a rule cause or consequence,
     * return false otherwise.
     * @param fact
     * @param ruleFact
     * @param mapping
     * @returns {*}
     */
    factMatches: function(fact, ruleFact, mapping, constants) {
        var localMapping = {};

        // Checks and update localMapping if matches
        if (!this.factElemMatches(fact.subject, ruleFact.subject, mapping, localMapping, constants)) {
            return false;
        }
        if (!this.factElemMatches(fact.predicate, ruleFact.predicate, mapping, localMapping, constants)) {
            return false;
        }
        if (!this.factElemMatches(fact.object, ruleFact.object, mapping, localMapping, constants)) {
            return false;
        }

        // If an already existing uri has been mapped...
        for (var key in localMapping) {
            if(constants.indexOf(localMapping[key]) !== -1) {
                return false;
            }
        }

        // Merges local and global mapping
        for (var mapKey in mapping) {
            if (mapKey == '__facts__') {
                localMapping[mapKey] = Utils.insertUnique(mapping[mapKey], fact)
            } else {
                for (var key in localMapping) {
                    if (mapping[mapKey] == localMapping[key]) {
                        if (mapKey != key) {
                            return false;
                        }
                    }
                }
                localMapping[mapKey] = mapping[mapKey];
            }
        }

        // Updates graph references
        if (localMapping.graphs) {
            localMapping.graphs = Utils.uniques(localMapping.graphs, fact.graphs);
        } else {
            localMapping.graphs = [];
        }

        // The new mapping is updated
        return localMapping;
    },

    factElemMatches: function(factElem, causeElem, globalMapping, localMapping, constants) {
        if (Logics.isVariable(causeElem)) {
            if (globalMapping[causeElem] && (globalMapping[causeElem] != factElem)) {
                return false;
            } else {
                localMapping[causeElem] = factElem;
            }
        } else {
            if (factElem != causeElem) {
                return false;
            }
        }

        return true;
    },

    /**
     * Substitutes an element given the mapping.
     * @param elem
     * @param mapping
     * @returns {*}
     */
    substituteElementVariablesWithMapping: function(elem, mapping) {
        if(Logics.isVariable(elem)) {
            if (mapping[elem] !== undefined) {
                return mapping[elem]
            }
        }
        return elem;
    },

    /**
     * Substitutes fact's variable members (sub, pred, obj)
     * given the mapping.
     * @param mapping
     * @param notYetSubstitutedFact
     * @param causedBy
     * @param graphs
     * @returns {*}
     */
    substituteFactVariables: function(mapping, notYetSubstitutedFact, causedBy, implicitCauses, graphs) {
        var subject, predicate, object, substitutedFact;

        if (mapping == {}) {
            return notYetSubstitutedFact;
        }

        subject = this.substituteElementVariablesWithMapping(notYetSubstitutedFact.subject, mapping);
        predicate = this.substituteElementVariablesWithMapping(notYetSubstitutedFact.predicate, mapping);
        object = this.substituteElementVariablesWithMapping(notYetSubstitutedFact.object, mapping);

        substitutedFact = new Fact(predicate, subject, object);

        if (causedBy) {
            substitutedFact.causedBy = causedBy;
            substitutedFact.explicit = false;
        }

        if (implicitCauses && implicitCauses.length > 0) {
            substitutedFact.implicitCauses = implicitCauses;
            substitutedFact.explicit = false;
        }

        if (graphs) {
            substitutedFact.graphs = graphs;
        }

        return substitutedFact;
    },

    substitute: function(atom, mappings, causedBy, graphs) {
        var substitutedFacts = [],
            substitutedFact;

        for (var i = 0; i < mappings.length; i++) {
            substitutedFact = this.substituteFactVariables(mappings[i], atom, causedBy, graphs);
            if(substitutedFact && Logics.factIsGround(substitutedFact)) {
                substitutedFacts.push(substitutedFact);
            }
        }

        return substitutedFacts;
    },

    matchHead: function(ruleSet, fact) {
        var tuples = [],
            atom;

        for (var i = 0; i < ruleSet.length; i++) {
            var mapping = {},
                annotatedQuery = new AnnotatedQuery(),
                head = ruleSet[i].consequences[0],
                ruleConstants = ruleSet[i].constants;

            if (ruleSet[i].consequences.length > 1) {
                throw 'B/F algorithm expects an unique consequence (HEAD)!';
            }

            mapping = this.factMatches(fact, head, mapping, ruleConstants);

            if (mapping) {
                for (var j = 0; j < ruleSet[i].causes.length; j++) {
                    atom = new AnnotatedQuery.atom(ruleSet[i].causes[j]);
                    annotatedQuery.addAtom(atom);
                }

                tuples.push({
                    mapping: mapping,
                    rule: ruleSet[i],
                    annotatedQuery: annotatedQuery
                });
            }
        }

        return tuples;
    },

    matchBody: function(ruleSet, fact) {
        var tuples = [];

        for (var i = 0; i < ruleSet.length; i++) {
            var mapping = {}, annotateDiff = true,
                currentMapping, atom,
                annotatedQuery = new AnnotatedQuery();

            for (var j = 0; j < ruleSet[i].causes.length; j++) {
                currentMapping = this.factMatches(fact, ruleSet[i].causes[j], mapping, ruleSet[i].constants);
                if (currentMapping) {
                    annotateDiff = false;
                    mapping = currentMapping;
                }
                annotatedQuery.addAtom(new AnnotatedQuery.atom(ruleSet[i].causes[j], annotateDiff));
            }
            annotatedQuery.addAtom(new AnnotatedQuery.atom(ruleSet[i].consequences[0], annotateDiff));

            if (!Utils.emptyObject(mapping)) {
                tuples.push({
                    mapping: (mapping || {}),
                    rule: ruleSet[i],
                    annotatedQuery: annotatedQuery
                });
            }

        }
        return tuples;
    },

    eval: function(X, annotatedQuery, Y, mapping, constants) {
        var mappings = [mapping], currentMapping,
            XWithoutY = Logics.minus(X, Y);

            for (var i = 0; i < X.length; i++) {
                for (var j = 0; j < annotatedQuery.atomsLen(); j++) {
                    currentMapping = this.factMatches(X[i], annotatedQuery.getAtom(j).value, mapping, constants);
                    if (currentMapping) {
                        mapping = currentMapping;
                        mappings.push(mapping);
                    }
                }

            }

        return mappings;
    }
};

module.exports = Solver;