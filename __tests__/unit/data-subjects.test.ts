import { phoneVariants } from '@/lib/repositories/dataSubjects';

describe('phone matching for data subject requests', () => {
  it('matches Nigerian numbers in local and international form', () => {
    expect(phoneVariants('0801 234 5678')).toEqual(['08012345678', '2348012345678']);
    expect(phoneVariants('+234 (801) 234-5678')).toEqual(['2348012345678', '08012345678']);
  });

  it('leaves other numbers as digits only', () => {
    expect(phoneVariants('+44 20 7946 0958')).toEqual(['442079460958']);
    expect(phoneVariants(undefined)).toEqual([]);
    expect(phoneVariants('---')).toEqual([]);
  });
});
