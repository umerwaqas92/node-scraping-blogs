// Use Node.js built-in fetch (Node.js 18+) or fallback to node-fetch
let fetch;
if (globalThis.fetch) {
  fetch = globalThis.fetch;
} else {
  // Fallback for older Node.js versions
  try {
    fetch = require('node-fetch');
  } catch (error) {
    console.error('Please upgrade to Node.js 18+ or install node-fetch@2: npm install node-fetch@2');
    process.exit(1);
  }
}

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

/**
 * Scrape a blog post using fetch and JSDOM
 * @param {string} url - The URL of the blog post to scrape
 * @returns {Promise<Object>} - The scraped blog data
 */
async function scrapeBlogPost(url) {
  try {
    console.log(`Scraping blog post: ${url}`);
    
    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract blog data
    const blogData = extractBlogData(document, url);
    
    return blogData;
    
  } catch (error) {
    console.error('Error scraping blog post:', error);
    throw error;
  }
}

/**
 * Extract blog data from the DOM document
 * @param {Document} document - The DOM document
 * @param {string} url - The original URL
 * @returns {Object} - The extracted blog data
 */
function extractBlogData(document, url) {
  // Get title
  const title = document.querySelector('title')?.textContent?.trim() || 
               document.querySelector('h1')?.textContent?.trim() || '';
  
  // Get meta description
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  
  // Get main/banner/cover image
  const mainImage = getMainImage(document);
  
  // Get all images with their captions/alt text
  const allImages = getAllImages(document);
  
  // Extract sections with their content and associated images
  const sections = extractSections(document);
  
  // Get main content
  const fullContent = getMainContent(document);
  
  return {
    url,
    title,
    metaDescription,
    sections,
    allImages: allImages.map(img => ({
      src: img.src,
      alt: img.alt,
      caption: img.caption
    })),
    fullContent: fullContent.substring(0, 3000),
    totalSections: sections.length,
    totalImages: allImages.length,
    mainImage
  };
}

/**
 * Get the main/featured image from the document
 * @param {Document} document - The DOM document
 * @returns {Object|null} - The main image data or null
 */
function getMainImage(document) {
  // Try different selectors for main/featured/banner images
  const selectors = [
    'meta[property="og:image"]', // Open Graph image
    'meta[name="twitter:image"]', // Twitter card image
    '.featured-image img',
    '.post-thumbnail img',
    '.entry-thumbnail img',
    '.hero-image img',
    '.banner-image img',
    '.cover-image img',
    'article img:first-of-type',
    '.post-content img:first-of-type',
    '.entry-content img:first-of-type'
  ];
  
  for (const selector of selectors) {
    if (selector.startsWith('meta')) {
      const metaTag = document.querySelector(selector);
      if (metaTag && metaTag.getAttribute('content')) {
        return {
          src: metaTag.getAttribute('content'),
          alt: 'Main/Featured Image',
          caption: '',
          type: 'meta-tag'
        };
      }
    } else {
      const img = document.querySelector(selector);
      if (img && img.src && !img.src.includes('data:image')) {
        return {
          src: img.src,
          alt: img.alt || 'Main/Featured Image',
          caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
          type: 'featured-image'
        };
      }
    }
  }
  
  // Fallback: get the first substantial image in the article
  const allArticleImages = Array.from(document.querySelectorAll('article img, .post-content img, .entry-content img'));
  if (allArticleImages.length > 0) {
    const firstImage = allArticleImages.find(img => img.src && !img.src.includes('data:image'));
    if (firstImage) {
      return {
        src: firstImage.src,
        alt: firstImage.alt || 'Main/Featured Image',
        caption: firstImage.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
        type: 'first-article-image'
      };
    }
  }
  
  return null;
}

/**
 * Get all images from the document
 * @param {Document} document - The DOM document
 * @returns {Array} - Array of image objects
 */
function getAllImages(document) {
  return Array.from(document.querySelectorAll('img')).map(img => ({
    src: img.src,
    alt: img.alt || '',
    caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
    element: img
  })).filter(img => img.src && !img.src.includes('data:image'));
}

/**
 * Extract sections from the document based on headings
 * @param {Document} document - The DOM document
 * @returns {Array} - Array of section objects
 */
function extractSections(document) {
  const sections = [];
  
  // Try to find headings (h1, h2, h3, h4, h5, h6)
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  
  headings.forEach((heading, index) => {
    const sectionTitle = heading.textContent?.trim();
    if (!sectionTitle) return;
    
    // Get content between this heading and the next heading
    let content = '';
    let sectionImages = [];
    let currentElement = heading.nextElementSibling;
    const nextHeading = headings[index + 1];
    
    while (currentElement && currentElement !== nextHeading) {
      // Extract text content
      if (currentElement.textContent?.trim()) {
        content += currentElement.textContent.trim() + '\n';
      }
      
      // Find images in this section
      const imagesInSection = currentElement.querySelectorAll('img');
      imagesInSection.forEach(img => {
        if (img.src && !img.src.includes('data:image')) {
          sectionImages.push({
            src: img.src,
            alt: img.alt || '',
            caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || ''
          });
        }
      });
      
      currentElement = currentElement.nextElementSibling;
    }
    
    sections.push({
      title: sectionTitle,
      content: content.trim(),
      images: sectionImages,
      headingLevel: heading.tagName.toLowerCase()
    });
  });
  
  // If no sections found with headings, try to extract paragraphs as sections
  if (sections.length === 0) {
    const paragraphs = Array.from(document.querySelectorAll('p'));
    paragraphs.forEach((p, index) => {
      const content = p.textContent?.trim();
      if (content && content.length > 50) {
        // Find nearby images
        let sectionImages = [];
        const nextElement = p.nextElementSibling;
        if (nextElement && nextElement.querySelector('img')) {
          const img = nextElement.querySelector('img');
          if (img.src && !img.src.includes('data:image')) {
            sectionImages.push({
              src: img.src,
              alt: img.alt || '',
              caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || ''
            });
          }
        }
        
        sections.push({
          title: `Section ${index + 1}`,
          content: content,
          images: sectionImages,
          headingLevel: 'paragraph'
        });
      }
    });
  }
  
  return sections;
}

/**
 * Get the main content from the document
 * @param {Document} document - The DOM document
 * @returns {string} - The main content text
 */
function getMainContent(document) {
  const contentSelectors = [
    'article',
    '.post-content',
    '.entry-content', 
    '.content',
    'main',
    '.blog-post',
    '[class*="content"]'
  ];
  
  let fullContent = '';
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      fullContent = element.textContent?.trim() || '';
      if (fullContent.length > 100) break; // Found substantial content
    }
  }
  
  return fullContent;
}

/**
 * Save scraped data to a JSON file
 * @param {Object} data - The scraped data
 * @param {string} filename - Optional filename (will generate timestamp-based name if not provided)
 * @returns {string} - The filename where data was saved
 */
function saveScrapedData(data, filename = null) {
  try {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `scrape-result-${timestamp}.json`;
    }
    
    // Create results directory if it doesn't exist
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }
    
    const filePath = path.join(resultsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Data saved to: ${filename}`);
    return filename;
  } catch (error) {
    console.error('Error saving data:', error);
    throw error;
  }
}

/**
 * Scrape multiple blog posts
 * @param {Array<string>} urls - Array of URLs to scrape
 * @returns {Promise<Array>} - Array of scraped blog data
 */
async function scrapeMultipleBlogPosts(urls) {
  const results = [];
  
  for (const url of urls) {
    try {
      console.log(`\n🔄 Processing: ${url}`);
      const result = await scrapeBlogPost(url);
      results.push({
        success: true,
        url,
        data: result,
        scrapedAt: new Date().toISOString()
      });
      
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${url}:`, error.message);
      results.push({
        success: false,
        url,
        error: error.message,
        scrapedAt: new Date().toISOString()
      });
    }
  }
  
  return results;
}

/**
 * Validate if a URL is properly formatted
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Example usage function
 */
async function exampleUsage() {
  try {
    // Example single blog post scraping - using a real blog URL
    const url = 'https://theaestheticloft.blog/vintage-bedroom-cabinet-3k5zj8xq2a/';
    
    if (!isValidUrl(url)) {
      console.error('❌ Invalid URL provided');
      return;
    }
    
    console.log('🚀 Starting blog scraping...');
    const result = await scrapeBlogPost(url);
    
    console.log('\n📊 Scraping Results:');
    console.log(`Title: ${result.title}`);
    console.log(`Sections: ${result.totalSections}`);
    console.log(`Images: ${result.totalImages}`);
    console.log(`Main Image: ${result.mainImage ? 'Found' : 'Not found'}`);
    console.log(`Content Length: ${result.fullContent.length} characters`);
    
    // Save the result
    const filename = saveScrapedData(result);
    console.log(`💾 Results saved to: ${filename}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error in example usage:', error);
  }
}

// Export functions for use in other modules
module.exports = {
  scrapeBlogPost,
  extractBlogData,
  getMainImage,
  getAllImages,
  extractSections,
  getMainContent,
  saveScrapedData,
  scrapeMultipleBlogPosts,
  isValidUrl,
  exampleUsage
};

// If this file is run directly, execute the example
if (require.main === module) {
  console.log('🔧 Blog Scraper Functions (Fetch-based)');
  console.log('📝 Available functions:');
  console.log('   - scrapeBlogPost(url)');
  console.log('   - scrapeMultipleBlogPosts(urls)');
  console.log('   - saveScrapedData(data, filename)');
  console.log('   - isValidUrl(url)');
  console.log('\n💡 Example usage:');
  console.log('   const { scrapeBlogPost } = require("./index2.js");');
  console.log('   scrapeBlogPost("https://example.com/blog").then(console.log);');
  
  // Run the example to demonstrate functionality
  console.log('\n🧪 Running example...');
  exampleUsage();
}
