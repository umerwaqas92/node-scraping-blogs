const puppeteer = require('puppeteer');

async function scrapeBlogPost(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Extract blog data
    const blogData = await page.evaluate((url) => {
      // Get title
      const title = document.querySelector('title')?.textContent?.trim() || 
                   document.querySelector('h1')?.textContent?.trim() || '';
      
      // Get meta description
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                             document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      
      // Get all images with their captions/alt text
      const images = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt || '',
        caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || ''
      })).filter(img => img.src && !img.src.includes('data:image'));
      
      // Get main content (try different selectors for blog content)
      const contentSelectors = [
        'article',
        '.post-content',
        '.entry-content', 
        '.content',
        'main',
        '.blog-post',
        '[class*="content"]'
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content = element.textContent?.trim() || '';
          if (content.length > 100) break; // Found substantial content
        }
      }
      
      return {
        url,
        title,
        metaDescription,
        images,
        content: content.substring(0, 2000) // Limit content length
      };
    }, url);
    
    return blogData;
    
  } catch (error) {
    console.error('Error scraping blog post:', error);
    return null;
  } finally {
    await browser.close();
  }
}

// Example usage
async function main() {
  const url = 'https://theaestheticloft.blog/spring-home-decor-5g7kq9j4xz/';
  
  console.log('Scraping blog post...');
  const result = await scrapeBlogPost(url);
  
  if (result) {
    console.log('Blog Post Data:');
    console.log('Title:', result.title);
    console.log('Meta Description:', result.metaDescription);
    console.log('Images found:', result.images.length);
    console.log('Content preview:', result.content.substring(0, 200) + '...');
    console.log('\nFull result:', JSON.stringify(result, null, 2));
  } else {
    console.log('Failed to scrape the blog post');
  }
}

// Run the scraper
main().catch(console.error);