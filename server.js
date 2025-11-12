import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.get('/kr-books', async (req, res) => {
  try {
    const { data } = await axios.get(
      'https://www.aladin.co.kr/shop/common/wbest.aspx?BranchType=1&BestType=Bestseller',
    );

    const $ = cheerio.load(data);
    const books = [];

    $('div.ss_book_box').each((i, el) => {
      if (books.length >= 20) return false; // 상위 20개만

      let imgSrc = $(el).find('img').attr('src');

      // 이미지 URL 처리
      if (!imgSrc) return;
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }
      if (!imgSrc.startsWith('https://image.aladin.co.kr/product')) return;

      // 제목, 저자, 출판사 추출
      const title =
        $(el).find('a.bo3').text().trim() ||
        $(el).find('.ss_book_list a').first().text().trim();

      const author =
        $(el).find('.ss_book_list').text().split('|')[0]?.trim() ||
        $(el).find('li').first().text().trim();

      const publisher =
        $(el).find('.ss_book_list').text().split('|')[1]?.trim() || '';

      books.push({
        title: title || '제목 없음',
        author: author || '저자 미상',
        publisher: publisher || '출판사 미상',
        image: imgSrc,
      });
    });

    console.log('✅ 한국 크롤링 성공:', books.length, '권');
    res.json({ books });
  } catch (err) {
    console.error('❌ 한국 크롤링 실패:', err);
    res.status(500).json({ error: '크롤링 실패', message: err.message });
  }
});

app.get('/us-books', async (req, res) => {
  try {
    const url = 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books';

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const books = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div[data-asin]'));

      return items.slice(0, 20).map((el, idx) => {
        // 제목
        const titleEl =
          el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y') ||
          el.querySelector('.p13n-sc-truncate') ||
          el.querySelector('div._cDEzb_p13n-sc-css-line-clamp-3_g3dy1');
        const title = titleEl ? titleEl.innerText.trim() : `Book ${idx + 1}`;

        // 저자
        const authorEl =
          el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_EWgCb') ||
          el.querySelector('.a-size-small.a-link-child') ||
          el.querySelector('a.a-size-small') ||
          el.querySelector('span.a-size-small');
        const author = authorEl ? authorEl.innerText.trim() : 'Unknown Author';

        // 이미지
        const imgEl = el.querySelector('img');
        const image = imgEl ? imgEl.src : '';

        // 링크
        const linkEl = el.querySelector('a');
        const href = linkEl ? linkEl.getAttribute('href') : '';
        const link = href ? 'https://www.amazon.com' + href : '';

        console.log(`${idx + 1}. ${title} - ${author}`);

        return { title, author, image, link };
      });
    });

    await browser.close();
    console.log(`✅ Amazon 크롤링 성공: ${books.length}권`);
    res.json({ books });
  } catch (err) {
    console.error('❌ Amazon Puppeteer 크롤링 실패:', err);
    res.status(500).json({ error: 'US 크롤링 실패', message: err.message });
  }
});

app.get('/jp-books', async (req, res) => {
  try {
    const url =
      'https://www.kinokuniya.co.jp/disp/CKnRankingPageCList.jsp?dispNo=107002001001&vTp=w';

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    const books = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll('.list_area_wrap > div'),
      );
      const allImages = Array.from(document.querySelectorAll('img'));
      const validBooks = [];

      items.slice(0, 20).forEach((el, idx) => {
        // =========================
        // 1️⃣ 제목 찾기
        // =========================
        let title = '';

        // 링크 텍스트 우선
        const linkEl =
          el.querySelector('a[href*="dsg"]') ||
          el.querySelector('a[href*="product"]');
        if (linkEl) {
          title = linkEl.innerText.trim() || linkEl.textContent.trim();
        }

        // 후보 클래스/태그
        if (!title) {
          const titleElements = [
            el.querySelector('.booksname'),
            el.querySelector('[class*="title"]'),
            el.querySelector('h3'),
            el.querySelector('h4'),
            el.querySelector('strong'),
            el.querySelector('span[class*="name"]'),
          ];

          for (let el2 of titleElements) {
            if (el2 && el2.innerText.trim()) {
              title = el2.innerText.trim();
              break;
            }
          }
        }

        // 이미지 alt/title
        if (!title) {
          const imgEl = el.querySelector('img');
          if (imgEl) title = imgEl.alt || imgEl.title || `Book ${idx + 1}`;
        }

        title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        // =========================
        // 2️⃣ 저자 찾기
        // =========================
        let author = '著者不明';
        const authorEl = el.querySelector('.clearfix.ml10');
        const fallbackAuthorEl = Array.from(el.querySelectorAll('*')).find(e =>
          e.innerText?.includes('著'),
        );
        if (authorEl) author = authorEl.innerText.trim();
        else if (fallbackAuthorEl) author = fallbackAuthorEl.innerText.trim();

        // =========================
        // 3️⃣ 이미지 찾기
        // =========================
        const imgEl = allImages.find(img => {
          const src = img.src || img.getAttribute('data-src') || '';
          if (!src) return false;
          if (
            src.includes('ranking') ||
            src.includes('number') ||
            src.includes('icon') ||
            src.includes('logo') ||
            src.includes('banner') ||
            src.includes('service') ||
            src.includes('event') ||
            src.includes('business') ||
            src.includes('store-event') ||
            src.includes('inc/')
          )
            return false;
          if (
            !(
              src.includes('product') ||
              src.includes('goods') ||
              src.includes('item')
            )
          )
            return false;

          return el.contains(img); // img가 현재 책 div 안에 있는지 확인
        });
        const image = imgEl
          ? imgEl.src || imgEl.getAttribute('data-src') || ''
          : '';

        // =========================
        // 4️⃣ 링크
        // =========================
        const linkHref = el.querySelector('a')?.getAttribute('href') || '';
        const link = linkHref
          ? linkHref.startsWith('http')
            ? linkHref
            : 'https://www.kinokuniya.co.jp' + linkHref
          : '';

        // =========================
        // 5️⃣ validBooks에 추가
        // =========================
        validBooks.push({ title, author, image, link });
      });

      return validBooks;
    });

    await browser.close();
    console.log(`✅ 일본 베스트셀러 ${books.length}권 크롤링 성공`);
    if (books.length > 0) console.log('첫 번째 책:', books[0]);
    res.json({ books });
  } catch (err) {
    console.error('❌ Puppeteer JP 크롤링 실패:', err);
    res.status(500).json({ error: 'JP 크롤링 실패', message: err.message });
  }
});

app.listen(4000, () => console.log(`🚀 JP Server running on port 4000`));
app.listen(4000, () => console.log('🚀 Amazon Server running on port 4000'));
app.listen(4000, () => console.log('🚀 Server running on port 4000'));
