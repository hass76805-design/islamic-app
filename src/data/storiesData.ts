import {StoryEntry} from '../types';
import {LESSONS_STORIES_30} from './storiesLessons30';
import {PROPHETS_STORIES_25} from './storiesProphets';
import {REPENTANCE_STORIES_20} from './storiesRepentance';
import {SAHABA_STORIES_PART_1} from './storiesSahaba1';
import {SAHABA_STORIES_PART_2} from './storiesSahaba2';

export const ISLAMIC_STORIES: StoryEntry[] = [
  ...PROPHETS_STORIES_25,
  ...SAHABA_STORIES_PART_1,
  ...SAHABA_STORIES_PART_2,
  ...LESSONS_STORIES_30,
  ...REPENTANCE_STORIES_20,
];
