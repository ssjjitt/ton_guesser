import { pipeline } from '@huggingface/transformers';

async function test() {
  console.log('Loading pipeline...');
  const segmenter = await pipeline('image-segmentation', 'Xenova/slimsam-77-uniform');
  console.log('Model loaded.');
  console.log('Segmenter:', segmenter);
}
test();
