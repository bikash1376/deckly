/**
 * Wipe this account's decks and seed two realistic ones.
 *
 * Development only. It deletes every deck belonging to the single user in the
 * database, which is fine while that user is the developer and catastrophic the
 * moment it is not, so it refuses to run if it finds more than one account.
 *
 * Usage: node seed.mjs .dev.vars
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

const raw = readFileSync(process.argv[2] ?? ".dev.vars", "utf8");
const url = raw
  .split("\n")
  .find((l) => l.trim().startsWith("DATABASE_URL="))
  .split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^['"]|['"]$/g, "");

const sql = neon(url);

const DECKS = [
  {
    title: "Design Engineering",
    subject: "Engineering",
    color: "clay",
    tldr:
      "Design engineering turns a requirement into something that can actually be built. It balances what the user needs against what materials, tolerances and cost will allow, and treats every choice as a trade you have to be able to defend.",
    outline: [
      {
        heading: "Requirements",
        points: [
          "Functional requirements say what it must do",
          "Constraints say what it must not exceed",
        ],
      },
      {
        heading: "Trade studies",
        points: ["Compare options against weighted criteria", "Document why the loser lost"],
      },
      {
        heading: "Tolerance and fit",
        points: ["Stacking tolerances decide whether parts assemble", "Tighter is not better, it is dearer"],
      },
      {
        heading: "Failure and safety",
        points: ["Factor of safety covers what you did not model", "FMEA finds failure modes before the field does"],
      },
    ],
    minutes: 14,
    flashcards: [
      {
        front: "What is the difference between a functional requirement and a constraint?",
        back: "A functional requirement says what the design must do. A constraint bounds how it may do it, such as mass, cost or envelope.",
        hint: "One describes behaviour, the other describes limits.",
      },
      {
        front: "Why is a tolerance stack-up analysis done before manufacturing?",
        back: "Because individual part tolerances accumulate across an assembly, and the total can exceed the fit even when every part is in spec.",
        hint: null,
      },
      {
        front: "What does a factor of safety actually account for?",
        back: "Uncertainty. Material variation, unmodelled loads, manufacturing defects and misuse, rather than a known extra load.",
        hint: null,
      },
      {
        front: "In a trade study, why record the reasoning for rejected options?",
        back: "Because requirements change. When they do, the rejected option may become the right one, and the reasoning tells you whether it now wins.",
        hint: null,
      },
      {
        front: "What is the purpose of an FMEA?",
        back: "To list how a design can fail, how likely and how severe each mode is, and to prioritise fixes before failures reach the field.",
        hint: "Failure Modes and Effects Analysis.",
      },
    ],
    quiz: [
      {
        question: "A bracket must weigh under 200g and must hold a 50N load. Which is the constraint?",
        options: [
          "Holding the 50N load",
          "Weighing under 200g",
          "Both are constraints",
          "Neither, both are functional requirements",
        ],
        correctIndex: 1,
        explanation:
          "Holding the load is what the bracket is for, so it is functional. The mass limit bounds how it may achieve that, which makes it a constraint. Calling both constraints is the common slip: it hides what the part is actually for.",
        concept: "Requirements",
      },
      {
        question: "Three stacked parts each have a tolerance of plus or minus 0.1mm. What is the worst case stack?",
        options: ["plus or minus 0.1mm", "plus or minus 0.17mm", "plus or minus 0.3mm", "plus or minus 0.9mm"],
        correctIndex: 2,
        explanation:
          "Worst case adds the tolerances arithmetically, giving 0.3mm. The 0.17mm answer is the statistical root sum square, which is less conservative and only valid when you can justify the distribution assumption.",
        concept: "Tolerance and fit",
      },
      {
        question: "Why is specifying a tighter tolerance than needed a design error?",
        options: [
          "It makes the part weaker",
          "It raises manufacturing cost and scrap rate for no functional gain",
          "It always prevents assembly",
          "It has no effect either way",
        ],
        correctIndex: 1,
        explanation:
          "Tolerance drives process choice. Tightening it beyond what the fit requires buys nothing and pushes the part towards slower, dearer processes with more scrap.",
        concept: "Tolerance and fit",
      },
      {
        question: "A design passes analysis with a factor of safety of 1.0. What does that mean in practice?",
        options: [
          "It is safe with margin to spare",
          "It fails exactly at the design load, with no allowance for uncertainty",
          "It cannot fail",
          "It is twice as strong as needed",
        ],
        correctIndex: 1,
        explanation:
          "A factor of 1.0 means predicted strength equals predicted load. Any material variation, unmodelled load or manufacturing defect pushes it into failure, which is why real designs carry margin.",
        concept: "Failure and safety",
      },
      {
        question: "In an FMEA, which failure mode should usually be addressed first?",
        options: [
          "The most likely one, regardless of severity",
          "The most severe one, regardless of likelihood",
          "The one with the highest combination of severity, likelihood and difficulty of detection",
          "The cheapest one to fix",
        ],
        correctIndex: 2,
        explanation:
          "FMEA ranks by risk priority, which combines all three. Taking severity alone over-weights rare catastrophes; taking likelihood alone ignores the ones that would end the programme.",
        concept: "Failure and safety",
      },
    ],
  },
  {
    title: "Machine Learning",
    subject: "Computing",
    color: "slate",
    tldr:
      "A model learns patterns from data rather than being told the rules. The whole discipline turns on one question: does what it learned generalise to data it has never seen, or did it memorise the training set?",
    outline: [
      {
        heading: "Generalisation",
        points: ["Training error is not the goal", "Held out data is the only honest measure"],
      },
      {
        heading: "Bias and variance",
        points: ["Underfitting misses real structure", "Overfitting learns the noise"],
      },
      {
        heading: "Evaluation",
        points: ["Accuracy misleads on imbalanced data", "Precision and recall trade against each other"],
      },
    ],
    minutes: 11,
    flashcards: [
      {
        front: "Why is training accuracy a poor measure of a model?",
        back: "Because a model can memorise the training set. Only data it has never seen shows whether it learned anything that generalises.",
        hint: null,
      },
      {
        front: "What is the difference between overfitting and underfitting?",
        back: "Overfitting learns noise in the training data and fails on new data. Underfitting is too simple to capture the real pattern and fails on both.",
        hint: "One learns too much, the other too little.",
      },
      {
        front: "When is accuracy a misleading metric?",
        back: "On imbalanced data. If 99 percent of cases are negative, always predicting negative scores 99 percent while catching nothing.",
        hint: null,
      },
    ],
    quiz: [
      {
        question: "A model scores 99 percent on training data and 62 percent on held out data. What is happening?",
        options: ["Underfitting", "Overfitting", "The test set is too small", "The model is well calibrated"],
        correctIndex: 1,
        explanation:
          "A large gap between training and held out performance is the signature of overfitting: the model learned the training set specifically rather than the pattern behind it. Underfitting would show poor scores on both.",
        concept: "Bias and variance",
      },
      {
        question: "A fraud detector labels everything as legitimate and scores 99.4 percent accuracy. Why is it useless?",
        options: [
          "Accuracy was calculated wrongly",
          "Fraud is rare, so ignoring it entirely still scores well",
          "It needs more training data",
          "The threshold is set too low",
        ],
        correctIndex: 1,
        explanation:
          "With a heavily imbalanced class, accuracy is dominated by the majority. It catches zero fraud, so recall on the positive class is zero, which is the number that actually matters here.",
        concept: "Evaluation",
      },
      {
        question: "What does raising a classifier's decision threshold usually do?",
        options: [
          "Raises precision and lowers recall",
          "Raises recall and lowers precision",
          "Raises both",
          "Has no effect on either",
        ],
        correctIndex: 0,
        explanation:
          "A higher bar means fewer positive predictions, so those you make are more often right (higher precision) but you miss more real positives (lower recall). You cannot raise both by moving a threshold.",
        concept: "Evaluation",
      },
      {
        question: "Why is a validation set kept separate from the test set?",
        options: [
          "To have more data overall",
          "Because tuning against a set makes its score optimistic, so a clean set is needed for the final estimate",
          "Because the test set must be larger",
          "They are the same thing",
        ],
        correctIndex: 1,
        explanation:
          "Every decision made by looking at a set leaks information about it into the model. The validation set absorbs that leakage during tuning; the test set stays untouched so the final number means something.",
        concept: "Generalisation",
      },
      {
        question: "A model underfits. Which change is most likely to help?",
        options: [
          "Add more regularisation",
          "Collect more of the same training data",
          "Increase model capacity or add better features",
          "Reduce the number of training epochs",
        ],
        correctIndex: 2,
        explanation:
          "Underfitting means the model cannot represent the pattern. More capacity or better features gives it something to work with. More regularisation or fewer epochs constrain it further, making it worse.",
        concept: "Bias and variance",
      },
      {
        question: "What is data leakage?",
        options: [
          "Losing training data to disk failure",
          "Information from outside the training set influencing the model, inflating its measured performance",
          "Training on too little data",
          "Sharing a dataset publicly",
        ],
        correctIndex: 1,
        explanation:
          "Leakage is when the model sees something at training time it will not have at prediction time, such as a feature derived from the answer. Scores look excellent and collapse in production.",
        concept: "Generalisation",
      },
      {
        question: "Cross validation is mainly used to do what?",
        options: [
          "Speed up training",
          "Get a more reliable performance estimate from limited data",
          "Reduce the size of the model",
          "Remove the need for a test set",
        ],
        correctIndex: 1,
        explanation:
          "Rotating which slice is held out and averaging gives an estimate that depends less on one lucky or unlucky split. It does not replace a final untouched test set.",
        concept: "Generalisation",
      },
    ],
  },
];

const users = await sql`select id, email from users`;
if (users.length === 0) {
  console.error("No users found. Sign in on the device first.");
  process.exit(1);
}
if (users.length > 1) {
  console.error(`Refusing to run: found ${users.length} accounts, not the expected 1.`);
  process.exit(1);
}

const userId = users[0].id;
console.log(`Seeding for ${users[0].email}\n`);

const before = await sql`select count(*)::int as n from decks where user_id = ${userId}`;
await sql`delete from decks where user_id = ${userId}`;
console.log(`Removed ${before[0].n} existing deck(s), with their cards and review history.\n`);

for (const deck of DECKS) {
  const deckId = randomUUID();

  await sql`
    insert into decks (id, user_id, title, subject, color, source_kind, source_ref, source_text,
                       tldr, outline, estimated_minutes)
    values (${deckId}, ${userId}, ${deck.title}, ${deck.subject}, ${deck.color},
            'topic', '', ${deck.tldr + "\n\n" + deck.outline.map((s) => `${s.heading}: ${s.points.join(". ")}`).join("\n")},
            ${deck.tldr}, ${JSON.stringify(deck.outline)}::jsonb, ${deck.minutes})`;

  const flashcardId = randomUUID();
  await sql`
    insert into cards (id, deck_id, user_id, kind, content, model, prompt_version)
    values (${flashcardId}, ${deckId}, ${userId}, 'flashcards',
            ${JSON.stringify({ cards: deck.flashcards })}::jsonb, 'seed', 'seed@1')`;

  // Every flashcard needs a scheduling row, or it never reaches the review queue.
  for (let i = 0; i < deck.flashcards.length; i++) {
    await sql`
      insert into reviews (user_id, deck_id, card_id, card_index, due_at)
      values (${userId}, ${deckId}, ${flashcardId}, ${i}, now())`;
  }

  await sql`
    insert into cards (id, deck_id, user_id, kind, content, model, prompt_version)
    values (${randomUUID()}, ${deckId}, ${userId}, 'quiz',
            ${JSON.stringify({ questions: deck.quiz })}::jsonb, 'seed', 'seed@1')`;

  console.log(
    `  ${deck.title.padEnd(22)} ${deck.flashcards.length} flashcards, ${deck.quiz.length} quiz questions`,
  );
}

const due = await sql`
  select count(*)::int as n from reviews where user_id = ${userId} and due_at <= now()`;
console.log(`\nAll ${due[0].n} flashcards are due now, so the Review tab has a full queue.`);
