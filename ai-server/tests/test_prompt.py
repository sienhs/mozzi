"""요청 값 → 프롬프트 조립 시험."""
from __future__ import annotations

import unittest

from worker.messages import InvalidMessage, Scene
from worker.prompt import build_prompt, rules

STYLE = "medium shot, warm children's picture-book illustration, crayon and watercolor textures"


def build(**kw):
    return build_prompt(Scene(**{"what": "cooking", **kw}))


class PromptTest(unittest.TestCase):
    def test_example_message(self):
        p = build(mood="happy", time_of_day="evening", where="at home", who="with mom")
        self.assertEqual(p.text, "mochi_char, happy, cooking, home kitchen, with a pale yellow family mochi, "
                                 f"warm sunset light through the window, {STYLE}")
        self.assertEqual(p.fixes, [])

    def test_defaults(self):
        p = build_prompt(Scene(what="reading"))
        self.assertEqual(p.text, f"mochi_char, neutral, reading, home living room, soft natural window light, {STYLE}")
        self.assertEqual(p.fixes, [])

    def test_aliases_and_case(self):
        p = build(what="Eating", mood="HAPPY", where="at the Coffee Shop", time_of_day="Night")
        self.assertIn("happy, eating, cozy cafe, cozy warm lamp light at night", p.text)

    def test_weather_and_time(self):
        cases = {  # (weather, timeOfDay, where) → 빛 문구
            ("rainy", "night", "at home"): "rain on the window with soft gray light, at night",
            ("Rain", "morning", "at home"): "rain on the window with soft gray light",
            ("snowy", "evening", "park"): "gentle snowfall and snowy ground, in the evening",
            ("sunny", "night", "park"): "night sky with soft moonlight",
            ("sunny", None, "park"): "bright sunny daylight",
            ("cloudy", None, "cafe"): "soft overcast light through the window",
            (None, "evening", "park"): "warm sunset light",
        }
        for (weather, time, where), light in cases.items():
            with self.subTest(weather=weather, time=time):
                p = build(weather=weather, time_of_day=time, where=where)
                self.assertIn(f", {light}, medium shot", p.text)
                self.assertEqual(p.fixes, [])

    def test_java_phrases(self):  # Java 가 보내는 모양: 전치사·관사·day 가 붙어 온다
        p = build(mood="CALM", time_of_day="in the evening", weather="on a rainy day", where="at home",
                  who="with mom", what="eating fried chicken and beer")
        self.assertEqual(p.text, "mochi_char, calm, eating fried chicken and beer, home, with a pale yellow family "
                                 f"mochi, rain on the window with soft gray light, in the evening, {STYLE}")
        self.assertEqual(p.fixes, [])
        for weather, want in {"on a sunny day": "bright sunny daylight", "on a snowy day": "gentle snowfall",
                              "in cloudy weather": "soft cloudy daylight"}.items():
            with self.subTest(weather):
                self.assertIn(want, build(weather=weather, where="at the park").text)

    def test_unknown_weather_is_fixed(self):
        p = build(weather="tornado", time_of_day="night")
        self.assertIn(", cozy warm lamp light at night, ", p.text)
        self.assertEqual(len(p.fixes), 1)

    def test_unknown_mood_and_time_are_fixed(self):
        p = build(mood="hungry", time_of_day="teatime")
        self.assertIn("mochi_char, neutral, cooking", p.text)
        self.assertEqual(len(p.fixes), 2)

    def test_custom_place_outdoor(self):
        p = build(what="building a sandcastle", where="at the beach", time_of_day="afternoon")
        self.assertIn("building a sandcastle, beach, bright afternoon daylight", p.text)

    def test_custom_place_people_word_removed(self):
        p = build(where="at grandma's house")
        self.assertIn("cooking, house, soft natural window light", p.text)
        self.assertTrue(any(f.startswith("where:") for f in p.fixes))

    def test_custom_what_cleaned(self):
        p = build(what="Baking cookies & decorating them!!")
        self.assertIn(", baking cookies decorating them, home,", p.text)
        self.assertNotIn("!!", p.text)

    def test_several_activities_become_props(self):
        p = build(what="cooking, reading, listening to music", where="at home")
        self.assertIn("mochi_char, neutral, cooking, home kitchen, soft natural window light, "
                      "an open book on the table, a pair of headphones on the table, medium shot", p.text)
        p = build(what="walking, taking photos", where="at the park")
        self.assertIn("walking, park, soft natural daylight, a small camera nearby, medium shot", p.text)
        p = build(what="cooking, decorating a cake")  # 모르는 활동은 소품 자리에 문구 그대로
        self.assertIn("soft natural window light, decorating a cake, medium shot", p.text)

    def test_too_many_activities(self):
        p = build(what="cooking, reading, gaming, cleaning")
        self.assertNotIn("broom", p.text)
        self.assertTrue(p.fixes[0].startswith("what:"))

    def test_default_tags_from_translation_doc(self):
        """TAG_TRANSLATION_RULES.md 프롬프트 용어집(GLOSSARY)의 영어가 모두 보정 없이 알아보는 값인지."""
        what = ["studying", "working", "exercising", "walking", "resting", "napping", "eating", "cooking",
                "baking", "cleaning", "doing laundry", "shopping", "reading", "writing", "drawing",
                "listening to music", "watching a movie", "gaming", "taking photos", "chatting", "watering plants",
                "visiting an art exhibition", "hiking", "traveling", "commuting"]
        where = {"at home": "home", "at a cafe": "cozy cafe", "at the office": "office",
                 "at school": "school classroom", "at the library": "library", "at a restaurant": "restaurant",
                 "at the park": "park", "in the neighborhood": "quiet neighborhood street", "at the beach": "beach",
                 "on a mountain": "mountain trail", "at a travel spot": "scenic travel spot"}
        who = {"with a friend": "a pale peach friend mochi", "with family": "two pale yellow family mochi",
               "with a partner": "a pale pink partner mochi", "with a coworker": "a small pale blue mochi",
               "with a child": "a pale yellow family mochi", "with a puppy": "a round mochi-style puppy",
               "with a kitten": "a round mochi-style kitten", "with a bunny": "a round mochi-style bunny",
               "with a hamster": "a round mochi-style hamster",
               "with a friend and a puppy": "a pale peach friend mochi and a round mochi-style puppy"}
        weather = ["on a sunny day", "on a cloudy day", "on a rainy day", "on a snowy day", "on a windy day",
                   "on a foggy day"]
        times = ["in the morning", "in the afternoon", "in the evening", "at night"]
        acts = {a["caption"] for a in rules()["activities"].values()}
        for w in what:
            with self.subTest(what=w):
                self.assertIn(w, acts)
                self.assertEqual(build(what=w).fixes, [])
        for raw, want in where.items():
            with self.subTest(where=raw):
                p = build(what="resting", where=raw)
                self.assertIn(f", {want}", p.text)
                self.assertEqual(p.fixes, [])
        for raw, want in who.items():
            with self.subTest(who=raw):
                p = build(who=raw)
                self.assertIn(f", with {want}", p.text)
                self.assertEqual(p.fixes, [])
        for raw in weather + times:
            with self.subTest(light=raw):
                self.assertEqual(build(weather=raw if raw in weather else None,
                                       time_of_day=raw if raw in times else None).fixes, [])

    def test_what_only_people_is_invalid(self):
        with self.assertRaises(InvalidMessage):
            build(what="with my friends")

    def test_who(self):
        cases = {
            "alone": None,
            "with mom and dad": "two pale yellow family mochi of different sizes",
            "with my parents": "two pale yellow family mochi of different sizes",
            "with friends": "two pale peach friend mochi",
            "with my boyfriend": "a pale pink partner mochi with a tiny heart",
            "with a coworker and my dog": "a small pale blue mochi with a tiny ID badge and a round mochi-style puppy",
            "with two cats": "two round mochi-style kittens",
        }
        for who, want in cases.items():
            with self.subTest(who):
                p = build(who=who)
                if want is None:
                    self.assertNotIn(" with ", p.text.split(", ")[4])
                else:
                    self.assertIn(f", with {want}, ", p.text)
                self.assertEqual(p.fixes, [])

    def test_who_unknown_and_too_many(self):
        p = build(who="with a stranger")  # 목록에 없는 사람 → 친구 모찌
        self.assertIn("with a pale peach friend mochi", p.text)
        p = build(who="with my teacher")
        self.assertIn("with a pale peach friend mochi", p.text)

    def test_who_other_animals(self):  # 목록에 없는 동물 → 그 동물을 모찌 스타일로
        self.assertIn(", with a round mochi-style parrot,", build(who="with a parrot").text)
        self.assertIn(", with a round mochi-style owl,", build(who="with an owl").text)
        self.assertIn(", with two round mochi-style turtles,", build(who="with two turtles").text)
        p = build(who="with a friend and a parrot")
        self.assertIn(", with a pale peach friend mochi and a round mochi-style parrot,", p.text)
        self.assertEqual(p.fixes, [])
        p = build(who="with mom, dad and my friend")  # 종류마다 1마리씩: 가족 1 + 친구 1
        self.assertIn("with a pale yellow family mochi and a pale peach friend mochi,", p.text)
        self.assertEqual(p.fixes, [])
        p = build(who="with family and a puppy")
        self.assertIn("with a pale yellow family mochi and a round mochi-style puppy,", p.text)
        p = build(who="with a friend, a puppy and a kitten")  # 종류 3개 → 앞의 2개
        self.assertNotIn("kitten", p.text)
        self.assertTrue(p.fixes[0].startswith("who:"))

    def test_thing_prop_keeps_article(self):
        p = build(what="eating, a small birthday cake")
        self.assertIn(", a small birthday cake, medium shot", p.text)

    def test_no_people_words_reach_prompt(self):
        people = set(rules()["people_words"]) - {"family", "partner"}  # 'family mochi' 등 동행 문구는 의도한 표현
        p = build(what="cooking with mom", where="mom's restaurant", who="with mom and my boyfriend")
        words = set(p.text.replace(",", " ").split())
        self.assertEqual(words & people, set(), p.text)

    def test_character_prompt(self):
        wear = "wearing a round orange pumpkin hood with a green vine on top and a short deep purple cape with gold trim"
        p = build(character_prompt=wear.capitalize() + ".")
        self.assertTrue(p.text.startswith(f"mochi_char {wear}, neutral, cooking"))
        self.assertEqual(p.fixes, [])

    def test_character_prompt_with_held_item(self):
        for cp in ["wearing a pink knitted hat with two long ears and holding an orange carrot with green leaves",
                   "holding a red and ivory striped candy cane",
                   "wearing a navy crescent hat and holding a gold hand mirror"]:
            with self.subTest(cp):
                p = build(character_prompt=cp)
                self.assertTrue(p.text.startswith(f"mochi_char {cp}, neutral"), p.text)
                self.assertEqual(p.fixes, [])

    def test_bad_character_prompt_is_dropped(self):
        for cp in ["a white round mochi with pink cheeks", "wearing a hood, holding a lantern",
                   "wearing a glowing halloween witch hat", "wearing " + "a very long red scarf " * 8]:
            with self.subTest(cp):
                p = build(character_prompt=cp)
                self.assertTrue(p.text.startswith("mochi_char, neutral"))
                self.assertTrue(p.fixes[0].startswith("characterPrompt:"))

    def test_prompt_has_no_extra_commas_from_input(self):
        p = build(what="baking", where="x, y", who="mom, dad")
        self.assertEqual(len(p.text.split(", ")), 9)  # 트리거·감정·활동·장소·동행·빛·구도·화풍(쉼표 1개 포함)


if __name__ == "__main__":
    unittest.main()
