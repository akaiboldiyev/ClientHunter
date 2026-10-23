import unittest

from scrapers.two_gis import _is_blocked, _number, _provider_id, _reviews


class TwoGisProviderParsingTests(unittest.TestCase):
    def test_extracts_provider_id_from_public_url(self):
        self.assertEqual(_provider_id('https://2gis.ru/aktau/firm/70000001012345678'), '70000001012345678')

    def test_extracts_public_rating_and_review_count(self):
        self.assertEqual(_number('Рейтинг 4,8'), 4.8)
        self.assertEqual(_number('5\nПодтверждён\n(50)'), 5)
        self.assertEqual(_reviews('5\nПодтверждён\n(50)'), 50)
        self.assertEqual(_reviews('126 отзывов'), 126)

    def test_identifies_provider_block_page_without_bypass(self):
        self.assertTrue(_is_blocked('CAPTCHA: automated access'))


if __name__ == '__main__':
    unittest.main()
