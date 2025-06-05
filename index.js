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
      
      // Get main/banner/cover image
      const mainImage = (() => {
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
        
        // Fallback: get the largest image in the article
        const allArticleImages = Array.from(document.querySelectorAll('article img, .post-content img, .entry-content img'));
        if (allArticleImages.length > 0) {
          // Sort by image size (width * height) if dimensions are available
          const largestImage = allArticleImages.reduce((largest, current) => {
            const currentSize = (current.naturalWidth || current.width || 0) * (current.naturalHeight || current.height || 0);
            const largestSize = (largest.naturalWidth || largest.width || 0) * (largest.naturalHeight || largest.height || 0);
            return currentSize > largestSize ? current : largest;
          });
          
          if (largestImage.src && !largestImage.src.includes('data:image')) {
            return {
              src: largestImage.src,
              alt: largestImage.alt || 'Main/Featured Image',
              caption: largestImage.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
              type: 'largest-image'
            };
          }
        }
        
        return null;
      })();
      
      // Get all images with their captions/alt text
      const allImages = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt || '',
        caption: img.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || '',
        element: img
      })).filter(img => img.src && !img.src.includes('data:image'));
      
      // Extract sections with their content and associated images
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
      
      let fullContent = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          fullContent = element.textContent?.trim() || '';
          if (fullContent.length > 100) break; // Found substantial content
        }
      }
      
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
        fullContent: fullContent.substring(0, 3000), // Increased limit
        totalSections: sections.length,
        totalImages: allImages.length,
        mainImage
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
  const url = 'https://theaestheticloft.blog/vintage-bedroom-cabinet-3k5zj8xq2a/';
  
  console.log('Scraping blog post...');
  const result = await scrapeBlogPost(url);
  
  if (result) {
    console.log('='.repeat(60));
    console.log('BLOG POST ANALYSIS');
    console.log('='.repeat(60));
    console.log('Title:', result.title);
    console.log('Meta Description:', result.metaDescription);
    
    // Display main/banner image
    if (result.mainImage) {
      console.log('\n🖼️  MAIN/BANNER IMAGE:');
      console.log(`   Alt Text: ${result.mainImage.alt}`);
      console.log(`   URL: ${result.mainImage.src}`);
      console.log(`   Type: ${result.mainImage.type}`);
      if (result.mainImage.caption) {
        console.log(`   Caption: ${result.mainImage.caption}`);
      }
    } else {
      console.log('\n🖼️  MAIN/BANNER IMAGE: Not found');
    }
    
    console.log('\nTotal Sections:', result.totalSections);
    console.log('Total Images:', result.totalImages);
    console.log('='.repeat(60));
    
    // Display each section
    result.sections.forEach((section, index) => {
      console.log(`\n📝 SECTION ${index + 1}: ${section.title}`);
      console.log(`Heading Level: ${section.headingLevel}`);
      console.log(`Content: ${section.content.substring(0, 200)}${section.content.length > 200 ? '...' : ''}`);
      
      if (section.images.length > 0) {
        console.log(`🖼️  Images in this section (${section.images.length}):`);
        section.images.forEach((img, imgIndex) => {
          console.log(`   ${imgIndex + 1}. ${img.alt || 'No alt text'}`);
          console.log(`      URL: ${img.src}`);
          if (img.caption) console.log(`      Caption: ${img.caption}`);
        });
      } else {
        console.log('🖼️  No images in this section');
      }
      console.log('-'.repeat(40));
    });
    
    console.log('\n📊 SUMMARY:');
    console.log(`- ${result.totalSections} sections extracted`);
    console.log(`- ${result.totalImages} total images found`);
    console.log(`- ${result.sections.filter(s => s.images.length > 0).length} sections with images`);
    
    // Save full result to JSON file for detailed analysis
    console.log('\n💾 Full result saved to result.json');
    require('fs').writeFileSync('result.json', JSON.stringify(result, null, 2));
    
  } else {
    console.log('Failed to scrape the blog post');
  }
}

// Run the scraper
main().catch(console.error);