// Mock types
interface InlineImage {
  contentId: string;
  mimeType: string;
  data: string;
}

// Functions from lib/gmailApi.ts
const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\\]/g, '\\$&');
};

const replaceCidWithDataUri = (body: string, inlineImages: InlineImage[]): string => {
  if (!body || inlineImages.length === 0) return body;

  let result = body;

  for (const image of inlineImages) {
    const cidPattern = new RegExp(`(src=["'])cid:${escapeRegExp(image.contentId)}(["'])`, 'gi');
    const dataUri = `data:${image.mimeType};base64,${image.data}`;
    result = result.replace(cidPattern, `$1${dataUri}$2`);
  }

  return result;
};

// Test cases
const runTests = () => {
  console.log("Running tests...");

  // Case 1: Simple match
  const body1 = '<img src="cid:image123" alt="test">';
  const images1 = [{ contentId: 'image123', mimeType: 'image/png', data: 'FAKE_DATA' }];
  const result1 = replaceCidWithDataUri(body1, images1);
  console.log("Case 1 (Simple):", result1.includes('data:image/png;base64,FAKE_DATA') ? "PASS" : "FAIL");
  console.log("  Output:", result1);

  // Case 2: Content-ID extraction logic simulation (stripped brackets)
  // Header: <image123@gmail.com> -> extracted as image123@gmail.com
  // Body: src="cid:image123@gmail.com"
  const body2 = '<img src="cid:image123@gmail.com">';
  const images2 = [{ contentId: 'image123@gmail.com', mimeType: 'image/jpeg', data: 'FAKE_DATA_2' }];
  const result2 = replaceCidWithDataUri(body2, images2);
  console.log("Case 2 (Email style ID):", result2.includes('data:image/jpeg;base64,FAKE_DATA_2') ? "PASS" : "FAIL");

  // Case 3: Single quotes
  const body3 = "<img src='cid:image123'>";
  const images3 = [{ contentId: 'image123', mimeType: 'image/png', data: 'FAKE_DATA' }];
  const result3 = replaceCidWithDataUri(body3, images3);
  console.log("Case 3 (Single quotes):", result3.includes('data:image/png;base64,FAKE_DATA') ? "PASS" : "FAIL");

  // Case 4: Mismatch due to encoding?
  // Sometimes body has cid:foo%40bar.com but content-id is foo@bar.com
  const body4 = '<img src="cid:foo%40bar.com">';
  const images4 = [{ contentId: 'foo@bar.com', mimeType: 'image/png', data: 'FAKE_DATA' }];
  const result4 = replaceCidWithDataUri(body4, images4);
  console.log("Case 4 (Encoding mismatch):", result4.includes('data:image/png;base64,FAKE_DATA') ? "FAIL (Expected behavior currently)" : "PASS (Unexpectedly worked)");
  
  // Case 5: 3D or new lines
  const body5 = '<img\n src="cid:image123">';
  const images5 = [{ contentId: 'image123', mimeType: 'image/png', data: 'FAKE_DATA' }];
  const result5 = replaceCidWithDataUri(body5, images5);
  console.log("Case 5 (Newline before src):", result5.includes('data:image/png;base64,FAKE_DATA') ? "PASS" : "FAIL");
};

runTests();
