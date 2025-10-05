import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import Replicate from 'replicate';
import axios from 'axios';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface Actor {
  id: number;
  name: string;
  profile_path: string | null;
}

interface Credit {
  title?: string;
  name?: string;
  popularity: number;
}

// Helper function to create a predictable "random" number generator from a seed
function createSeededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Helper function to get actor details for hints
const getActorDetails = async (actorId: number) => {
  const params = { api_key: process.env.TMDB_API_KEY };
  try {
    const [personDetailsRes, combinedCreditsRes] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/person/${actorId}`, { params }),
      axios.get(`https://api.themoviedb.org/3/person/${actorId}/combined_credits`, { params }),
    ]);

    const name = personDetailsRes.data.name || '';
    const initial = name.split(' ').map((n: string) => n[0]).join('');
    const poster = personDetailsRes.data.profile_path;

    const credits: Credit[] = combinedCreditsRes.data.cast || [];
    const popularCredits = credits
      .filter((c: Credit) => c.title || c.name)
      .sort((a: Credit, b: Credit) => b.popularity - a.popularity)
      .slice(0, 10)
      .map((c: Credit) => c.title || c.name);

    // Shuffle the top 10 and pick 3
    for (let i = popularCredits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [popularCredits[i], popularCredits[j]] = [popularCredits[j], popularCredits[i]];
    }
    const known_for_titles = popularCredits.slice(0, 3).join(', ');
    const birthdate = new Date(personDetailsRes.data.birthday).toLocaleDateString();
    return {
      initial,
      known_for_titles,
      birthdate,
      poster
    };
  } catch {
    return { initial: '???', known_for: 'A famous role', birthday: 'Within the past 100 years' };
  }
};

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const cachePath = path.join(process.cwd(), 'lib', 'cache.json');
    const modelIdentifier = 'stability-ai/sdxl';
    let cache: { [key: string]: string } = {};
     try {
      const cacheFile = await fs.readFile(cachePath, 'utf8');
      cache = JSON.parse(cacheFile);
    } catch (error) {
      console.log('Cache file not found. A new one will be created.', error);

    }
    const imageUrlKey = `imageUrl_${today}`;
    const modelVersionKey = `modelVersion_${today}`;
    const {actor1Poster, actor2Poster, correctActor1, correctActor2, answerOptions, correctAnswers, actor1hints, actor2hints } = await generatePuzzleData()
    let fusedImageUrl = cache[imageUrlKey];

    if (fusedImageUrl) {
      console.log('Cache hit! Serving from local JSON file.');
    } else {
      console.log('Cache miss! Generating new image with Replicate...');
      
    let modelVersion = cache[modelVersionKey];

    if (!modelVersion) {
        console.log('Fetching latest model version from Replicate...');
        const [modelOwner, modelName] = modelIdentifier.split('/');
        const model = await replicate.models.get(modelOwner, modelName);
        if(!model?.latest_version?.id){
          throw new Error(`Could not find a valid version for model ${modelIdentifier}`);
        }
        modelVersion = model.latest_version.id;
        cache[modelVersionKey] = modelVersion;
        await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
        console.log('Latest model version cached:', modelVersion);
      } else {
        console.log('Using cached model version:', modelVersion);
      }

      const prediction = await replicate.predictions.create({
        version: modelVersion,
        input: {
          prompt: `photorealistic, studio portrait of a single person who is a perfect genetic blend of ${correctActor1.name} and ${correctActor2.name}, 4k, high detail`,
          negative_prompt: "cartoon, drawing, anime, ugly, disfigured, cropped head",
        },
      });

      const completedPrediction = await replicate.wait(prediction);

      if (completedPrediction.status !== 'succeeded' || !completedPrediction.output) {
        throw new Error("Image generation failed or produced no output.");
      }

      fusedImageUrl = (completedPrediction.output as string[])[0];

      cache[imageUrlKey] = fusedImageUrl;
      await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
      console.log('New image URL saved to cache.json.');
    }

    return NextResponse.json({
      fusedImageUrl,
      answerOptions,
      correctAnswers,
      actor1hints,
      actor2hints,
      actor1Poster,
      actor2Poster
    });

  } catch (error) {
    console.error('Failed to generate daily game:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
async function generatePuzzleData() {
  
    const jsonPath = path.join(process.cwd(), 'lib', 'actors.json');
    const fileContents = await fs.readFile(jsonPath, 'utf8');
    const actors: Actor[] = JSON.parse(fileContents);
    const today = new Date().toISOString().split('T')[0];
    const seededRandom = createSeededRandom(today);
    const index1 = Math.floor(seededRandom() * actors.length);
    let index2 = Math.floor(seededRandom() * actors.length);
    while (index1 === index2) {
      index2 = Math.floor(seededRandom() * actors.length);
    }
    const correctActor1 = actors[index1];
    const correctActor2 = actors[index2];
    const decoys: Actor[] = [];
    const usedIndices = new Set([index1, index2]);
    while (decoys.length < 7) {
      const decoyIndex = Math.floor(seededRandom() * actors.length);
      if (!usedIndices.has(decoyIndex)) {
        decoys.push(actors[decoyIndex]);
        usedIndices.add(decoyIndex);
      }
    }
    const answerOptions = [correctActor1, correctActor2, ...decoys].map(a => a.name);
    for (let i = answerOptions.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [answerOptions[i], answerOptions[j]] = [answerOptions[j], answerOptions[i]];
    }
    
    const [details1, details2] = await Promise.all([
      getActorDetails(correctActor1.id),
      getActorDetails(correctActor2.id),
    ]);

    const actor1hints = [
      `${details1.birthdate}`,
      `${details1.known_for_titles}`,
      `${details1.initial}`,
    ]
    
    const actor2hints = [
      `${details2.birthdate}`,
      `${details2.known_for_titles}`,
      `${details2.initial}`,
    ];

    return { actor1Poster: details1.poster, actor2Poster: details2.poster, correctActor1, correctActor2, answerOptions, correctAnswers: [correctActor1.name, correctActor2.name], actor1hints, actor2hints };
}