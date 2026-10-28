package com.ssafy.mozzi.integration.gms;

import java.util.Map;

/**
 * One structured call to the Responses API.
 *
 * @param instructions the rules the model follows (system message)
 * @param input        the material: the question, the diaries found. Contains user text
 *                     and is never logged
 * @param schemaName   names the schema in the request; letters, digits, {@code _} and
 *                     {@code -}
 * @param schema       JSON Schema of the answer. Sent with {@code strict: true}, so it must
 *                     list every property as required and set {@code additionalProperties}
 *                     to false; the answer then always matches it
 */
public record GmsPrompt(String instructions, String input, String schemaName, Map<String, Object> schema) {
}
