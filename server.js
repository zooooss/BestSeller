import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
//아래는 캐시화를 위해 추가한 임포트문
import fs from 'fs/promises'; //노드에서 사용가능한 내장함수로 filesystem 함수 여럿 내장되어있음
import path from 'path';
import { Buffer } from 'node:buffer';

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

// 캐시 디렉토리 경로
const CACHE_DIR = path.join(process.cwd(), 'crawlCache');
const CACHE_FILES = {
  kr: path.join(CACHE_DIR, 'krbooks.json'),
  us: path.join(CACHE_DIR, 'usbooks.json'),
  jp: path.join(CACHE_DIR, 'jpbooks.json'),
};
// 상세 정보 캐시 디렉토리
const DETAIL_CACHE_DIR = path.join(CACHE_DIR, 'details');

// 캐시 유효 기간 (7일 = 604800000ms)
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// 캐시 디렉토리 생성
async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR); //폴더존재확인하는부분!
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true }); //없으면 생성
  }

  try {
    await fs.access(DETAIL_CACHE_DIR); //중첩폴더의미! details 이 부분
  } catch {
    await fs.mkdir(DETAIL_CACHE_DIR, { recursive: true });
  }
}

// 캐시 읽기
async function readCache(country) {
  try {
    const cacheFile = CACHE_FILES[country];
    const data = await fs.readFile(cacheFile, 'utf-8');
    const cache = JSON.parse(data);

    // 캐시가 유효한지 확인
    const now = Date.now();
    if (now - cache.timestamp < CACHE_DURATION) {
      console.log(
        `✅ ${country.toUpperCase()} 캐시 사용 (${new Date(
          cache.timestamp,
        ).toLocaleString()}에 저장됨)`,
      );
      return cache.data;
    } else {
      console.log(`⏰ ${country.toUpperCase()} 캐시 만료됨`);
      return null;
    }
  } catch (err) {
    console.log(
      `📝 ${country.toUpperCase()} 캐시 파일 없음, 새로 크롤링합니다`,
    );
    return null;
  }
}

// 캐시 저장
async function writeCache(country, data) {
  try {
    await ensureCacheDir();
    const cacheFile = CACHE_FILES[country];
    const cache = {
      timestamp: Date.now(),
      data: data,
    };
    await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
    console.log(`💾 ${country.toUpperCase()} 캐시 저장 완료`);
  } catch (err) {
    console.error(`❌ ${country.toUpperCase()} 캐시 저장 실패:`, err);
  }
}

// URL을 파일명으로 변환 (특수문자 제거)
function urlToFileName(url) {
  return Buffer.from(url).toString('base64').replace(/[/+=]/g, '_');
}

// 상세 정보 캐시 읽기
async function readDetailCache(country, url) {
  try {
    const fileName = urlToFileName(url);
    const filePath = path.join(DETAIL_CACHE_DIR, `${country}_${fileName}.json`);

    const data = await fs.readFile(filePath, 'utf-8');
    const cache = JSON.parse(data);

    // 캐시가 유효한지 확인
    const now = Date.now();
    if (now - cache.timestamp < CACHE_DURATION) {
      console.log(`✅ ${country.toUpperCase()} 상세 정보 캐시 사용`);
      return cache.data;
    } else {
      console.log(`⏰ ${country.toUpperCase()} 상세 정보 캐시 만료됨`);
      return null;
    }
  } catch (err) {
    console.log(
      `📝 ${country.toUpperCase()} 상세 정보 캐시 없음, 새로 크롤링합니다`,
    );
    return null;
  }
}

// 상세 정보 캐시 저장
async function writeDetailCache(country, url, data) {
  try {
    await ensureCacheDir();
    const fileName = urlToFileName(url);
    const filePath = path.join(DETAIL_CACHE_DIR, `${country}_${fileName}.json`);

    const cache = {
      timestamp: Date.now(),
      url: url,
      data: data,
    };

    await fs.writeFile(filePath, JSON.stringify(cache, null, 2), 'utf-8');
    console.log(`💾 ${country.toUpperCase()} 상세 정보 캐시 저장 완료`);
  } catch (err) {
    console.error(`❌ ${country.toUpperCase()} 상세 정보 캐시 저장 실패:`, err);
  }
}

// 한국 베스트셀러
app.get('/kr-books', async (req, res) => {
  try {
    // 캐시 확인
    const cachedData = await readCache('kr');
    if (cachedData) {
      return res.json(cachedData);
    }

    // 캐시가 없으면 크롤링
    console.log('🔄 한국 베스트셀러 크롤링 시작...');
    const { data } = await axios.get(
      'https://www.aladin.co.kr/shop/common/wbest.aspx?BranchType=1&BestType=Bestseller',
    );

    const $ = cheerio.load(data);
    const books = [];

    $('div.ss_book_box').each((i, el) => {
      if (books.length >= 20) return false;

      let imgSrc = $(el).find('img').attr('src');

      if (!imgSrc) return;
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }
      if (!imgSrc.startsWith('https://image.aladin.co.kr/product')) return;

      const title =
        $(el).find('a.bo3').text().trim() ||
        $(el).find('.ss_book_list a').first().text().trim();

      let author = '저자 미상';
      $(el)
        .find('.ss_book_list ul li')
        .each((idx, li) => {
          const liText = $(li).text().trim();
          if (
            liText.includes('|') &&
            (liText.includes('지은이') ||
              liText.includes('옮긴이') ||
              liText.includes('엮은이') ||
              liText.includes('글') ||
              liText.includes('그림'))
          ) {
            const parts = liText.split('|').map(p => p.trim());
            if (parts[0]) {
              author = parts[0];
            }
            return false;
          }
        });

      const publisher =
        $(el).find('.ss_book_list').text().split('|')[1]?.trim() || '';

      books.push({
        title: title || '제목 없음',
        author: author || '저자 미상',
        publisher: publisher || '출판사 미상',
        image: imgSrc,
        link:
          $(el).find('a.bo3').attr('href') ||
          $(el).find('.ss_book_list a').first().attr('href') ||
          '',
      });

      if (
        books[books.length - 1].link &&
        !books[books.length - 1].link.startsWith('http')
      ) {
        books[books.length - 1].link =
          'https://www.aladin.co.kr' + books[books.length - 1].link;
      }
    });

    console.log('✅ 한국 크롤링 성공:', books.length, '권');

    const result = { books };
    await writeCache('kr', result);
    res.json(result);
  } catch (err) {
    console.error('❌ 한국 크롤링 실패:', err);
    res.status(500).json({ error: '크롤링 실패', message: err.message });
  }
});

// 한국 책 상세 정보 (캐시 적용)
app.get('/kr-book-detail', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    // 캐시 확인
    const cachedData = await readDetailCache('kr', url);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('📘 한국 책 상세 정보 크롤링:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookDetail = await page.evaluate(() => {
      let description = '';
      const boxes = document.querySelectorAll('.Ere_prod_mconts_box');

      boxes.forEach((box, idx) => {
        const titleEl = box.querySelector('.Ere_prod_mconts_LL');
        const contentEl = box.querySelector('.Ere_prod_mconts_R');

        if (!titleEl || !contentEl) return;

        const title = titleEl.innerText.trim();
        const content = contentEl.innerText.trim();

        if (title.includes('책소개') || title === '책소개') {
          description = content;
        }
      });

      let plot = '';
      const storyShort = document.getElementById('div_Story_Short');
      const storyAll = document.getElementById('div_Story_All');

      if (storyAll && storyAll.style.display !== 'none') {
        plot = storyAll.innerText.trim();
      } else if (storyShort) {
        plot = storyShort.innerText.trim();
      }

      let authorInfo = '';
      const introEl = document.querySelector('.introduction');
      if (introEl) {
        authorInfo = introEl.innerText.trim();
      } else {
        const authorBox = document.querySelector('.author_box');
        if (authorBox) {
          authorInfo = authorBox.innerText.trim();
        }
      }

      let publisher = '';
      let publishDate = '';

      const infoTable = document.querySelector('table.Ere_prod_info_table');
      if (infoTable) {
        const rows = infoTable.querySelectorAll('tr');
        rows.forEach(row => {
          const th = row.querySelector('th');
          const td = row.querySelector('td');
          if (th && td) {
            const label = th.innerText.trim();
            const value = td.innerText.trim();
            if (label.includes('출판사')) {
              publisher = value;
            }
            if (label.includes('출간일') || label.includes('발행일')) {
              publishDate = value;
            }
          }
        });
      }

      return {
        description,
        plot,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    // 캐시 저장
    await writeDetailCache('kr', url, bookDetail);

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 한국 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

// 미국 베스트셀러
app.get('/us-books', async (req, res) => {
  try {
    const cachedData = await readCache('us');
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('🔄 미국 베스트셀러 크롤링 시작...');
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
        const titleEl =
          el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y') ||
          el.querySelector('.p13n-sc-truncate') ||
          el.querySelector('div._cDEzb_p13n-sc-css-line-clamp-3_g3dy1');
        const title = titleEl ? titleEl.innerText.trim() : `Book ${idx + 1}`;

        const authorEl =
          el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_EWgCb') ||
          el.querySelector('.a-size-small.a-link-child') ||
          el.querySelector('a.a-size-small') ||
          el.querySelector('span.a-size-small');
        const author = authorEl ? authorEl.innerText.trim() : 'Unknown Author';

        const imgEl = el.querySelector('img');
        const image = imgEl ? imgEl.src : '';

        const linkEl = el.querySelector('a');
        const href = linkEl ? linkEl.getAttribute('href') : '';
        const link = href ? 'https://www.amazon.com' + href : '';

        return { title, author, image, link };
      });
    });

    await browser.close();
    console.log(`✅ Amazon 크롤링 성공: ${books.length}권`);

    const result = { books };
    await writeCache('us', result);
    res.json(result);
  } catch (err) {
    console.error('❌ Amazon 크롤링 실패:', err);
    res.status(500).json({ error: 'US 크롤링 실패', message: err.message });
  }
});

// 미국 책 상세 정보
app.get('/us-book-detail', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    // 캐시 확인
    const cachedData = await readDetailCache('us', url);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('📘 미국 책 상세 정보 크롤링:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const bookDetail = await page.evaluate(() => {
      let description = '';

      const expanderButtons = document.querySelectorAll(
        '[data-a-expander-name="book_description_expander"]',
      );
      expanderButtons.forEach(btn => {
        if (btn.click) btn.click();
      });

      const bookDescDiv = document.querySelector(
        '#bookDescription_feature_div',
      );
      if (bookDescDiv) {
        const expanderContent = bookDescDiv.querySelector(
          '.a-expander-content',
        );
        if (expanderContent && expanderContent.innerText.trim().length > 50) {
          description = expanderContent.innerText.trim();
        }

        if (!description) {
          const spans = bookDescDiv.querySelectorAll('span');
          for (let span of spans) {
            if (span.innerText && span.innerText.trim().length > 50) {
              description = span.innerText.trim();
              break;
            }
          }
        }
      }

      let authorInfo = '';
      const editorialDiv = document.querySelector(
        '#editorialReviews_feature_div',
      );
      if (editorialDiv) {
        const sections = editorialDiv.querySelectorAll(
          '.a-section.a-spacing-small.a-padding-small',
        );

        for (let section of sections) {
          const text = section.innerText.trim();
          if (text.length > 100) {
            authorInfo = text;
            break;
          }
        }

        if (!authorInfo) {
          const text = editorialDiv.innerText.trim();
          if (text.length > 100) {
            authorInfo = text;
          }
        }
      }

      let publisher = '';
      let publishDate = '';

      const detailBullets = document.querySelectorAll(
        '#detailBullets_feature_div li, ' +
          '#detailBulletsWrapper_feature_div li, ' +
          '.detail-bullet-list li',
      );

      detailBullets.forEach(li => {
        const text = li.innerText || '';
        if (text.includes('Publisher') || text.includes('출판')) {
          const parts = text.split(':');
          if (parts.length > 1) {
            publisher = parts[1].trim();
          }
        }
        if (text.includes('Publication date') || text.includes('발행일')) {
          const parts = text.split(':');
          if (parts.length > 1) {
            publishDate = parts[1].trim();
          }
        }
      });

      return {
        description,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    // 캐시 저장
    await writeDetailCache('us', url, bookDetail);

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 미국 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

// 일본 베스트셀러
app.get('/jp-books', async (req, res) => {
  try {
    const cachedData = await readCache('jp');
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('🔄 일본 베스트셀러 크롤링 시작...');
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
        let title = '';

        const linkEl =
          el.querySelector('a[href*="dsg"]') ||
          el.querySelector('a[href*="product"]');
        if (linkEl) {
          title = linkEl.innerText.trim() || linkEl.textContent.trim();
        }

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

        if (!title) {
          const imgEl = el.querySelector('img');
          if (imgEl) title = imgEl.alt || imgEl.title || `Book ${idx + 1}`;
        }

        title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        let author = '著者不明';
        const authorEl = el.querySelector('.clearfix.ml10');
        const fallbackAuthorEl = Array.from(el.querySelectorAll('*')).find(e =>
          e.innerText?.includes('著'),
        );
        if (authorEl) author = authorEl.innerText.trim();
        else if (fallbackAuthorEl) author = fallbackAuthorEl.innerText.trim();

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

          return el.contains(img);
        });
        const image = imgEl
          ? imgEl.src || imgEl.getAttribute('data-src') || ''
          : '';

        const linkHref = el.querySelector('a')?.getAttribute('href') || '';
        const link = linkHref
          ? linkHref.startsWith('http')
            ? linkHref
            : 'https://www.kinokuniya.co.jp' + linkHref
          : '';

        validBooks.push({ title, author, image, link });
      });

      return validBooks;
    });

    await browser.close();
    console.log(`✅ 일본 베스트셀러 ${books.length}권 크롤링 성공`);

    const result = { books };
    await writeCache('jp', result);
    res.json(result);
  } catch (err) {
    console.error('❌ Puppeteer JP 크롤링 실패:', err);
    res.status(500).json({ error: 'JP 크롤링 실패', message: err.message });
  }
});

// 일본 책 상세 정보
app.get('/jp-book-detail', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    // 캐시 확인
    const cachedData = await readDetailCache('jp', url);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('📘 일본 책 상세 정보 크롤링:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookDetail = await page.evaluate(() => {
      let description = '';
      const descEl = document.querySelector('p[itemprop="description"]');
      if (descEl) {
        description = descEl.innerText.trim();
      }

      let plot = '';
      const careerBox = document.querySelector('.career_box');
      if (careerBox) {
        const paragraphs = careerBox.querySelectorAll('p');
        const textParts = [];

        for (let p of paragraphs) {
          const text = p.innerText.trim();
          if (text && !p.hasAttribute('itemprop')) {
            textParts.push(text);
          }
        }

        if (textParts.length > 0) {
          plot = textParts.slice(0, 3).join('\n\n');
        }
      }

      let authorInfo = '';
      if (careerBox) {
        const allText = careerBox.innerText;
        const lines = allText.split('\n');
        let foundAuthorSection = false;
        const authorLines = [];

        for (let line of lines) {
          line = line.trim();
          if (!line) continue;

          if (
            line.includes('저자') ||
            line.includes('著者') ||
            line.includes('作者') ||
            line.includes('저자 등 소개') ||
            line.includes('著者紹介')
          ) {
            foundAuthorSection = true;
            continue;
          }

          if (foundAuthorSection) {
            if (
              line.includes('내용 설명') ||
              line.includes('内容説明') ||
              line.includes('목차') ||
              line.includes('目次')
            ) {
              break;
            }
            authorLines.push(line);
          }
        }

        if (authorLines.length > 0) {
          authorInfo = authorLines.join('\n');
        }
      }

      let publisher = '';
      let publishDate = '';

      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const th = row.querySelector('th');
          const td = row.querySelector('td');
          if (th && td) {
            const label = th.innerText.trim();
            const value = td.innerText.trim();

            if (label.includes('出版社') || label.includes('출판사')) {
              publisher = value;
            }
            if (
              label.includes('発行年月') ||
              label.includes('発売日') ||
              label.includes('발행일')
            ) {
              publishDate = value;
            }
          }
        });
      });

      return {
        description,
        plot,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    // 캐시 저장
    await writeDetailCache('jp', url, bookDetail);

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 일본 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: 'JP 상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

// 캐시 상태 확인 엔드포인트 (선택사항)
app.get('/cache-status', async (req, res) => {
  try {
    const status = {
      lists: {},
      details: {
        kr: 0,
        us: 0,
        jp: 0,
      },
    };

    // 베스트셀러 목록 캐시 확인
    for (const [country, filePath] of Object.entries(CACHE_FILES)) {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const cache = JSON.parse(data);
        const age = Date.now() - cache.timestamp;
        const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
        const isValid = age < CACHE_DURATION;

        status.lists[country] = {
          exists: true,
          timestamp: new Date(cache.timestamp).toLocaleString('ko-KR'),
          daysOld,
          isValid,
          booksCount: cache.data?.books?.length || 0,
        };
      } catch {
        status.lists[country] = {
          exists: false,
        };
      }
    }

    // 상세 정보 캐시 개수 확인
    try {
      const files = await fs.readdir(DETAIL_CACHE_DIR);
      status.details.kr = files.filter(f => f.startsWith('kr_')).length;
      status.details.us = files.filter(f => f.startsWith('us_')).length;
      status.details.jp = files.filter(f => f.startsWith('jp_')).length;
      status.details.total = files.length;
    } catch (err) {
      console.log('상세 정보 캐시 디렉토리 없음');
    }

    res.json(status);
  } catch (err) {
    res
      .status(500)
      .json({ error: '캐시 상태 확인 실패', message: err.message });
  }
});

// 캐시 강제 삭제 엔드포인트 (선택사항)
app.delete('/cache/:country', async (req, res) => {
  try {
    const { country } = req.params;
    const cacheFile = CACHE_FILES[country];

    if (!cacheFile) {
      return res.status(400).json({ error: '잘못된 국가 코드' });
    }

    // 베스트셀러 목록 캐시 삭제
    try {
      await fs.unlink(cacheFile);
      console.log(`🗑️ ${country.toUpperCase()} 목록 캐시 삭제 완료`);
    } catch (err) {
      console.log(`목록 캐시 파일 없음: ${country}`);
    }

    // 해당 국가의 상세 정보 캐시 삭제
    try {
      const files = await fs.readdir(DETAIL_CACHE_DIR);
      const countryFiles = files.filter(f => f.startsWith(`${country}_`));

      for (const file of countryFiles) {
        await fs.unlink(path.join(DETAIL_CACHE_DIR, file));
      }

      console.log(
        `🗑️ ${country.toUpperCase()} 상세 정보 캐시 ${
          countryFiles.length
        }개 삭제 완료`,
      );

      res.json({
        message: `${country.toUpperCase()} 캐시가 삭제되었습니다`,
        deletedDetails: countryFiles.length,
      });
    } catch (err) {
      console.log(`상세 정보 캐시 파일 없음: ${country}`);
      res.json({
        message: `${country.toUpperCase()} 목록 캐시가 삭제되었습니다`,
        deletedDetails: 0,
      });
    }
  } catch (err) {
    res.status(500).json({ error: '캐시 삭제 실패', message: err.message });
  }
});

app.listen(4000, () => {
  console.log('🚀 Server running on port 4000');
  console.log('📦 캐시 기능 활성화 (유효기간: 7일)');
  console.log('📂 캐시 저장 경로:', CACHE_DIR);
});
app.listen(4000, () => console.log(`🚀 JP Server running on port 4000`));
app.listen(4000, () => console.log('🚀 Amazon Server running on port 4000'));
app.listen(4000, () => console.log('🚀 Server running on port 4000'));
