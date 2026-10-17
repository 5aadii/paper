"""Image extraction from the common RSS image formats."""
from fetcher import parse_feed

SPEC = {"url": "https://example.com/feed", "topic": "technology", "source_hint": None, "is_explore": False}


def feed(item_xml: str) -> bytes:
    return f"""<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"
      xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Feed</title>
      <item><title>A long enough headline for the test</title><link>https://example.com/a</link>{item_xml}</item>
      </channel></rss>""".encode()


def test_guardian_media_content_picks_largest():
    x = feed('<media:content width="140" url="https://i.guim.co.uk/small.jpg"/>'
             '<media:content width="460" url="https://i.guim.co.uk/big.jpg"/>')
    assert parse_feed(x, SPEC)[0]["image_url"] == "https://i.guim.co.uk/big.jpg"


def test_bbc_thumbnail_is_upgraded():
    x = feed('<media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/x.jpg"/>')
    assert parse_feed(x, SPEC)[0]["image_url"] == "https://ichef.bbci.co.uk/ace/standard/976/cpsprodpb/x.jpg"


def test_img_inside_content_html():
    x = feed('<content:encoded><![CDATA[<p><img src="https://cdn.site.com/photo.jpg?w=800" /></p>]]></content:encoded>')
    assert parse_feed(x, SPEC)[0]["image_url"] == "https://cdn.site.com/photo.jpg?w=800"


def test_enclosure_image():
    x = feed('<enclosure url="https://cdn.site.com/e.png" type="image/png" length="1"/>')
    assert parse_feed(x, SPEC)[0]["image_url"] == "https://cdn.site.com/e.png"


def test_no_image_is_none():
    assert parse_feed(feed("<description>Just text.</description>"), SPEC)[0]["image_url"] is None
