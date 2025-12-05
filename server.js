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
  uk: path.join(CACHE_DIR, 'ukbooks.json'),
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
// 영국 베스트셀러
app.get('/uk-books', async (req, res) => {
  try {
    const cachedData = await readCache('uk');
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('🔄 영국 베스트셀러 크롤링 시작...');
    const url = 'https://www.waterstones.com/books/bestsellers';

    const browser = await puppeteer.launch({
      headless: 'new', // 'new' headless 모드 사용
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
      ],
    });
    const page = await browser.newPage();

    // 봇 감지 우회
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      window.navigator.chrome = {
        runtime: {},
      };

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-GB', 'en-US', 'en'],
      });
    });

    // 랜덤 User Agent
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    ];
    await page.setUserAgent(
      userAgents[Math.floor(Math.random() * userAgents.length)],
    );

    // 뷰포트 설정
    await page.setViewport({ width: 1920, height: 1080 });

    // 추가 헤더 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 40000,
      });

      // 페이지 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      // lazy loading 이미지를 강제로 로드
      await page.evaluate(() => {
        // 모든 이미지를 viewport에 노출시키기
        const images = document.querySelectorAll(
          'img[data-src], img[data-lazy-src], img[loading="lazy"]',
        );
        images.forEach(img => {
          // data-src를 src로 복사
          if (img.getAttribute('data-src')) {
            img.src = img.getAttribute('data-src');
          }
          if (img.getAttribute('data-lazy-src')) {
            img.src = img.getAttribute('data-lazy-src');
          }
          // lazy loading 제거
          img.removeAttribute('loading');
        });
      });

      // 천천히 스크롤하여 모든 이미지 로드
      for (let i = 0; i <= 10; i++) {
        await page.evaluate(step => {
          window.scrollTo(0, (document.body.scrollHeight / 10) * step);
        }, i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 맨 위로 스크롤
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 책 데이터 추출 (여러 셀렉터 시도)
      const books = await page.evaluate(() => {
        const items = [];

        // 가능한 셀렉터들
        const selectors = [
          '.book-item',
          '.search-result-item',
          '[data-book]',
          '.book-card',
          'article.book',
          '.product-item',
          'div[data-isbn]',
        ];

        let elements = [];
        for (const selector of selectors) {
          elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            console.log(
              `Found ${elements.length} books with selector: ${selector}`,
            );
            break;
          }
        }

        // 데이터 추출
        return elements.slice(0, 20).map((el, idx) => {
          // 제목 추출
          let title = '';
          const titleSelectors = [
            '.title',
            '.book-title',
            'h3',
            'h2',
            '[class*="title"]',
            'a[title]',
          ];
          for (const sel of titleSelectors) {
            const titleEl = el.querySelector(sel);
            if (titleEl) {
              title =
                titleEl.innerText?.trim() ||
                titleEl.getAttribute('title') ||
                '';
              if (title) break;
            }
          }
          if (!title) title = `Book ${idx + 1}`;

          // 저자 추출
          let author = '';
          const authorSelectors = [
            '.author',
            '.book-author',
            '[class*="author"]',
            '.contributor',
            'a[href*="author"]',
          ];
          for (const sel of authorSelectors) {
            const authorEl = el.querySelector(sel);
            if (authorEl) {
              author = authorEl.innerText?.trim() || '';
              if (author) break;
            }
          }
          if (!author) author = 'Unknown Author';

          // 이미지 추출 (여러 속성 확인)
          let image = '';
          const imgEl = el.querySelector('img');
          if (imgEl) {
            image =
              imgEl.getAttribute('data-src') ||
              imgEl.getAttribute('data-lazy-src') ||
              imgEl.getAttribute('data-original') ||
              imgEl.src ||
              imgEl.getAttribute('srcset')?.split(' ')[0] ||
              '';

            // cover404.png는 제외
            if (image && image.includes('cover404.png')) {
              image = '';
            }

            // 상대 경로면 절대 경로로 변환
            if (
              image &&
              !image.startsWith('http') &&
              !image.startsWith('data:')
            ) {
              image = `https://www.waterstones.com${image}`;
            }
          }

          // 링크 추출
          let link = '';
          const linkEl = el.querySelector('a[href]');
          if (linkEl) {
            const href = linkEl.getAttribute('href');
            if (href) {
              link = href.startsWith('http')
                ? href
                : `https://www.waterstones.com${href}`;
            }
          }

          return { title, author, image, link };
        });
      });

      await browser.close();

      if (books.length === 0) {
        console.log('⚠️ 책을 찾지 못했습니다. 페이지 구조를 확인하세요.');
        // 페이지 HTML을 로깅하여 디버깅
        const bodyHTML = await page.evaluate(() => document.body.innerHTML);
        console.log('페이지 일부:', bodyHTML.substring(0, 500));
      }

      console.log(`✅ Waterstones 크롤링 성공: ${books.length}권`);

      const result = { books };
      await writeCache('uk', result);
      res.json(result);
    } catch (navError) {
      await browser.close();
      throw navError;
    }
  } catch (err) {
    console.error('❌ Waterstones 크롤링 실패:', err);
    res.status(500).json({ error: 'UK 크롤링 실패', message: err.message });
  }
});

// 영국 책 상세 정보
app.get('/uk-book-detail', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    const cachedData = await readDetailCache('uk', url);
    if (cachedData) {
      return res.json(cachedData);
    }

    console.log('📘 영국 책 상세 정보 크롤링:', url);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
    });
    const page = await browser.newPage();

    // 봇 감지 우회
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      window.navigator.chrome = {
        runtime: {},
      };

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    );

    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 스크롤
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookDetail = await page.evaluate(() => {
      let description = '';
      let review = '';
      let publisher = '';

      // 책 설명/시놉시스 추출
      const descSelectors = [
        '[class*="book-description"]',
        '[class*="synopsis"]',
        '[class*="description"]',
        '.book-information p',
        'div[itemprop="description"]',
      ];

      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim().length > 50) {
          description = el.innerText.trim();
          break;
        }
      }

      // 리뷰 추출
      const reviewSelectors = [
        '[class*="review"]',
        '[class*="editorial"]',
        '.book-review',
        '[data-test*="review"]',
      ];

      for (const sel of reviewSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim().length > 50) {
          review = el.innerText.trim();
          break;
        }
      }

      // Publisher 추출
      const allText = document.body.innerText;
      const pubMatch = allText.match(/Publisher[:\s]+([^\n]+)/i);
      if (pubMatch) {
        publisher = pubMatch[1].trim();
      }

      // 상세 정보 섹션에서도 추출 시도
      if (!publisher) {
        const detailElements = document.querySelectorAll(
          '[class*="book-info"], [class*="details"], .specifications',
        );
        detailElements.forEach(section => {
          const text = section.innerText;
          if (text.includes('Publisher')) {
            const match = text.match(/Publisher[:\s]+([^\n]+)/i);
            if (match) publisher = match[1].trim();
          }
        });
      }

      return {
        description,
        review,
        publisher,
      };
    });

    await browser.close();

    await writeDetailCache('uk', url, bookDetail);

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 영국 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

// 🔄 서버 시작 시 캐시 워밍업 (자동 크롤링)
async function warmupCache() {
  console.log('🔥 캐시 워밍업 시작...');

  const countries = ['kr', 'us', 'jp', 'uk'];

  for (const country of countries) {
    try {
      const cachedData = await readCache(country);

      if (!cachedData) {
        console.log(`⏳ ${country.toUpperCase()} 캐시 없음 - 크롤링 시작...`);

        // 각 국가별로 크롤링 실행
        let booksResponse;
        if (country === 'kr') {
          booksResponse = await axios.get('http://localhost:4000/kr-books');
        } else if (country === 'us') {
          booksResponse = await axios.get('http://localhost:4000/us-books');
        } else if (country === 'jp') {
          booksResponse = await axios.get('http://localhost:4000/jp-books');
        } else if (country === 'uk') {
          booksResponse = await axios.get('http://localhost:4000/uk-books');
        }

        console.log(`✅ ${country.toUpperCase()} 목록 워밍업 완료`);

        // 🔑 상세 정보도 미리 크롤링
        if (booksResponse?.data?.books) {
          console.log(`⏳ ${country.toUpperCase()} 상세 정보 워밍업 시작...`);
          await warmupBookDetails(country, booksResponse.data.books);
        }
      } else {
        console.log(`✅ ${country.toUpperCase()} 캐시 이미 존재 (워밍업 생략)`);
      }
    } catch (err) {
      console.error(`❌ ${country.toUpperCase()} 워밍업 실패:`, err.message);
    }
  }

  console.log('🎉 캐시 워밍업 완료! 서버 준비됨');
}

// 🔥 책 상세 정보 워밍업 (백그라운드에서 천천히 크롤링)
async function warmupBookDetails(country, books) {
  let successCount = 0;
  let skipCount = 0;

  for (const [index, book] of books.entries()) {
    if (!book.link) continue;

    try {
      // 이미 캐시가 있는지 확인
      const cachedDetail = await readDetailCache(country, book.link);
      if (cachedDetail) {
        skipCount++;
        continue;
      }

      // 캐시가 없으면 크롤링
      const endpoint =
        country === 'kr'
          ? '/kr-book-detail'
          : country === 'us'
          ? '/us-book-detail'
          : country === 'jp'
          ? '/jp-book-detail'
          : '/uk-book-detail';

      await axios.get(
        `http://localhost:4000${endpoint}?url=${encodeURIComponent(book.link)}`,
      );
      successCount++;

      console.log(
        `  📖 ${country.toUpperCase()} [${index + 1}/${
          books.length
        }] ${book.title?.substring(0, 30)}... 완료`,
      );

      // 서버 부담 줄이기 위해 각 책 사이 2초 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error(
        `  ❌ ${country.toUpperCase()} [${index + 1}] 상세 정보 실패:`,
        err.message,
      );
    }
  }

  console.log(
    `✅ ${country.toUpperCase()} 상세 정보 워밍업 완료 (성공: ${successCount}, 스킵: ${skipCount})`,
  );
}

// 🕐 정기적인 캐시 갱신 (6일마다 자동 갱신)
function startCacheRefreshSchedule() {
  const SIX_DAYS = 6 * 24 * 60 * 60 * 1000; // 6일 (7일 전에 미리 갱신)

  setInterval(async () => {
    console.log('⏰ 정기 캐시 갱신 시작...');

    // 모든 캐시 삭제
    for (const country of ['kr', 'us', 'jp', 'uk']) {
      try {
        const cacheFile = CACHE_FILES[country];
        await fs.unlink(cacheFile);
        console.log(`🗑️ ${country.toUpperCase()} 캐시 삭제`);
      } catch (err) {
        // 파일 없으면 무시
      }
    }

    // 새로 크롤링
    await warmupCache();
    // 캐시 갱신 후 책 상세 정보 워밍업
  }, SIX_DAYS);

  console.log('⏰ 정기 갱신 스케줄러 시작 (6일마다)');
}

app.listen(4000, async () => {
  // ⭐ async 추가
  console.log('🚀 Server running on port 4000');
  console.log('📦 캐시 기능 활성화 (유효기간: 7일)');
  console.log('📂 캐시 저장 경로:', CACHE_DIR);

  // ⭐ 서버 시작 후 자동 워밍업
  setTimeout(() => {
    warmupCache().catch(err => console.error('워밍업 에러:', err));
  }, 1000); // 1초 후 시작 (서버 완전히 켜진 후)

  // ⭐ 정기 갱신 스케줄러 시작
  startCacheRefreshSchedule();
});
