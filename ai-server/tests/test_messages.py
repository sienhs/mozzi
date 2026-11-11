"""python -m unittest discover tests  (GPU·AWS 없이 돈다)"""
from __future__ import annotations

import json
import unittest

from worker.messages import ErrorCode, InvalidMessage, failure, parse_request
from worker.s3 import object_key


def body(**over) -> str:
    d = {"diaryId": 102, "userId": 12, "date": "2026-10-28", "emotion": "CALM",
         "characterImageUrl": "https://x/characters/7.webp", "characterPrompt": "wearing a red scarf",
         "timeOfDay": "in the evening", "weather": "on a rainy day", "where": "at home", "who": "with mom",
         "what": "cooking"}
    d.update(over)
    return json.dumps(d)


class ParseRequestTest(unittest.TestCase):
    def test_ok(self):
        r = parse_request(body())
        self.assertEqual((r.diary_id, r.user_id, r.date.isoformat()), (102, 12, "2026-10-28"))
        self.assertEqual(r.scene.mood, "CALM")
        self.assertEqual(r.scene.what, "cooking")
        self.assertEqual(r.scene.weather, "on a rainy day")
        self.assertEqual(r.scene.character_prompt, "wearing a red scarf")
        self.assertEqual(r.character_image_url, "https://x/characters/7.webp")

    def test_default_character_ignores_prompt(self):
        r = parse_request(body(characterImageUrl="DEFAULT",
                               characterPrompt="a white round mochi with pink cheeks and short limbs"))
        self.assertIsNone(r.character_image_url)
        self.assertIsNone(r.scene.character_prompt)

    def test_empty_values_are_none(self):
        r = parse_request(body(timeOfDay="", weather="", where="", who="  "))
        self.assertIsNone(r.scene.time_of_day)
        self.assertIsNone(r.scene.weather)
        self.assertIsNone(r.scene.where)
        self.assertIsNone(r.scene.who)

    def test_unreadable_has_no_diary_id(self):
        for b in ["{broken", "[]", body(diaryId=None), body(diaryId="102"), body(diaryId=0), body(diaryId=True)]:
            with self.subTest(b), self.assertRaises(InvalidMessage) as c:
                parse_request(b)
            self.assertIsNone(c.exception.diary_id)

    def test_errors_keep_diary_id(self):
        cases = {
            "empty what": body(what=""),
            "what not string": body(what=3),
            "no date": body(date=""),
            "bad date": body(date="10/28"),
            "bad image url": body(characterImageUrl="file:///etc/passwd"),
        }
        for name, b in cases.items():
            with self.subTest(name), self.assertRaises(InvalidMessage) as c:
                parse_request(b)
            self.assertEqual((c.exception.diary_id, c.exception.user_id), (102, 12))

    def test_bad_user_id_keeps_diary_id(self):
        for uid in [None, "", "../x", -1, 1.5]:
            with self.subTest(uid), self.assertRaises(InvalidMessage) as c:
                parse_request(body(userId=uid))
            self.assertEqual(c.exception.diary_id, 102)
        self.assertEqual(parse_request(body(userId="12")).user_id, 12)  # 숫자 문자열도 받는다

    def test_test_flag(self):
        self.assertFalse(parse_request(body()).test)  # 없으면 false
        self.assertFalse(parse_request(body(test=False)).test)
        self.assertTrue(parse_request(body(test=True)).test)
        for bad in ["true", 1, "yes"]:
            with self.subTest(bad), self.assertRaises(InvalidMessage) as c:
                parse_request(body(test=bad))
            self.assertEqual(c.exception.diary_id, 102)

    def test_object_key(self):
        mid = "6f1c2a9e-1b2c-4d5e-8f90-123456789abc"
        self.assertEqual(object_key("diary", parse_request(body()), mid), "diary/12/102/6f1c2a9e1b2c.png")


class ResultTest(unittest.TestCase):
    def test_failure_json_is_camel_case(self):
        d = json.loads(failure(102, 12, ErrorCode.EXPIRED, "too old").to_json())
        self.assertEqual(d, {"diaryId": 102, "userId": 12, "status": "FAILED", "imageUrl": None,
                             "errorCode": "EXPIRED", "errorMessage": "too old"})


if __name__ == "__main__":
    unittest.main()
