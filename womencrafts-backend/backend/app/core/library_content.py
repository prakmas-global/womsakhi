"""
The library Sakhi answers from.

Before this file, the whole content collection held **zero words of prose** —
eight rows, every one a title with an empty description. An assistant asked
"what does the library say about pricing?" could only ever reply that it found
nothing, which is exactly what it did. Retrieval has nothing to retrieve without
something written down.

These are the guides the questions women actually ask keep landing on: what to
charge, how to get paid, how to borrow, what the law owes you. Each is written
to be read on a phone by someone who may be reading in her second or third
language — short paragraphs, plain sentences, no jargon that is not immediately
explained.

── This is a starting corpus, not a finished one ────────────────────────────
Written here rather than by a domain expert, because the alternative was an
empty library. Two things follow from that, and neither should be quietly
forgotten:

  * The money, credit and legal guides state general practice in India. Rules
    change, they vary by state, and a woman may act on what she reads here. A
    person who knows the subject should read those three before this goes in
    front of real users — the same standard the app already applies to
    translations it has not had checked (`LOCALES.reviewed`).

  * Nothing here names a specific lender, scheme amount, or legal deadline. A
    wrong number is worse than a missing one, so the guides teach what to ask
    and where to ask it rather than inventing specifics that would date badly.
"""

from __future__ import annotations

# (slug, title, type, description, body)
GUIDES: list[tuple[str, str, str, str, str]] = [
    (
        "pricing-your-work",
        "What should I charge for my work?",
        "Guide",
        "How to work out a price that covers your materials, your time and a profit — instead of guessing and losing money.",
        """Most women who sell what they make are charging too little, and the reason is
almost always the same: the price was worked out from materials alone, and the
hours went in free.

Start with three numbers.

**What the materials cost.** Everything that goes into one piece — cloth,
thread, beads, packaging, the bag you hand it over in. Add it up for one item,
not for the whole roll you bought.

**What your time is worth.** Decide what one hour of your work should earn. If
you are not sure, think about what you would need to earn in a day for this to
be worth doing instead of other work. Then count honestly how many hours one
piece takes, including the cutting and the finishing, not only the stitching.

**What it costs you to be in business.** Electricity, thread that breaks,
machine servicing, travel to buy materials, the pieces that go wrong. These are
real costs even though they do not belong to any single order. A simple way to
handle them is to add ten to twenty percent on top of materials and time.

Add those three together. That is your cost — the number below which you are
paying for the privilege of working.

Your price is that cost plus profit. Profit is not greed; it is what lets you
buy more material, replace a machine, or take a week off when you are ill.

Two things women commonly get wrong.

The first is matching a neighbour's price without knowing her costs. She may
buy cheaper, work faster, or be quietly losing money.

The second is discounting to win an order. If someone bargains, it is usually
better to give less — fewer pieces, simpler finishing, a longer delivery date —
than to give the same work for less money. Once you drop a price for a customer
it is very hard to raise it again.

If a customer says you are expensive, ask what they are comparing you to. Often
they are comparing handmade work to factory work, and the answer is not a lower
price but an explanation of the difference.""",
    ),
    (
        "getting-paid-on-time",
        "Getting paid, and getting paid on time",
        "Guide",
        "Advances, part payments and what to do when a customer keeps saying next week.",
        """Doing the work is only half the job. Being paid for it is the other half, and
it is the half most people never plan for.

**Take an advance.** For any custom order, ask for part of the money before you
start — commonly a third to a half. It covers your materials so you are not
funding someone else's order out of your own pocket, and a customer who has paid
something is far less likely to disappear.

**Say the price before you start, not after.** Write it in a message so both of
you have it. Most disputes are not dishonesty; they are two people remembering a
conversation differently.

**Agree when the rest is due.** "On delivery" is clear. "Later" is not.

**Keep the record simple.** A notebook or a phone note with the date, the
customer, what was agreed, what was paid and what is outstanding is enough. You
cannot chase what you have not written down.

When someone does not pay, ask early and ask plainly. A short message — what the
work was, what is outstanding, and when you expect it — is not rude. Waiting
three months and then being angry is much harder for both of you.

If it keeps happening with the same customer, stop taking their orders without
full payment in advance. You are allowed to do this. A customer who only buys
from you when they can delay paying is not really a customer.

For anything large, take payment in stages tied to the work: some at the start,
some when it is half done, the rest at delivery. Nobody is ever owed the whole
amount, and neither of you is carrying all the risk.""",
    ),
    (
        "selling-on-whatsapp",
        "Selling on WhatsApp without losing orders",
        "Guide",
        "Setting up a catalogue, replying quickly, and keeping orders from getting lost in your chats.",
        """For most women selling from home, WhatsApp is already where the customers are.
The problem is not reach — it is that orders get lost between family messages.

**Use WhatsApp Business.** It is a separate free app and it does things the
normal one cannot: a catalogue of what you sell with prices, quick replies for
questions you answer twenty times a week, labels to mark which orders are new,
paid or delivered, and an away message for when you are not free.

**Put your prices in the catalogue.** Many women leave prices out, hoping to
discuss them. It mostly loses customers — people who will not ask simply do not
ask.

**Photograph in daylight.** Near a window or door, in the morning, against a
plain cloth. The single biggest difference between a listing that sells and one
that does not is usually light, not the camera.

**Reply fast, even if the answer is not ready.** "I will check and tell you in an
hour" keeps an order alive. Silence loses it to whoever answered first.

**Label every order.** New, In progress, Waiting for payment, Delivered. When
you have fifteen conversations running you will not remember which is which, and
one forgotten order costs more than the whole system costs to run.

**Keep a status.** Photos of finished work, posted regularly, mean people think
of you when they need something. It costs nothing and reaches everyone who has
your number.

One warning: keep business and personal on separate numbers if you possibly can.
Being able to close the shop at night matters more than you expect.""",
    ),
    (
        "borrowing-money-safely",
        "Borrowing money for your work",
        "Guide",
        "What kinds of loan exist, what papers you will be asked for, and how to tell a fair one from a trap.",
        """Needing money to grow — a second machine, more material, a bigger space — is a
normal stage, not a failure. What matters is where it comes from.

**Know what the loan will actually cost.** The number that matters is not the
monthly instalment, it is the total you repay. Ask directly: how much will I have
paid back in total by the end? Any lender who will not answer that plainly is
telling you something.

**Understand the rate.** Interest quoted per month sounds small and is not — two
percent a month is roughly twenty-four percent a year. Always convert to a yearly
number before comparing.

**Where women commonly borrow.** Self-help groups and joint liability groups
usually lend at lower rates than moneylenders and are used to lending small
amounts for exactly this purpose. Banks lend to businesses and generally want to
see that money comes in regularly. Microfinance institutions sit between the two.
There are also government-backed schemes intended for small enterprises and for
women specifically — which ones apply depends on your state and your work, so ask
at a bank branch or a local support organisation rather than relying on what
someone tells you second-hand.

**Papers you will usually need.** Identity proof, address proof, a bank account
in your own name, and some record of your work — even a notebook showing what
comes in and goes out. This is one of the practical reasons to keep accounts
before you need a loan, not after.

**Signs to walk away from.** A lender who will not put the terms in writing. One
who asks for blank signed papers. One who takes your identity documents and keeps
them. One whose repayment is due before you could possibly earn from what you
borrowed for.

**Borrow for something that earns.** A machine that lets you take more orders
pays for itself. Borrowing to cover a shortfall usually just moves the problem
forward and makes it bigger.

Rules and schemes change and vary by state. Treat this as what to ask about, and
confirm the specifics at a bank or a support organisation before you sign.""",
    ),
    (
        "keeping-simple-accounts",
        "Keeping accounts without an accountant",
        "Guide",
        "The smallest record-keeping that actually tells you whether you are making money.",
        """You do not need bookkeeping software. You need to be able to answer three
questions: what came in, what went out, and who owes me.

**One notebook, one line per transaction.** Date, what it was, money in, money
out. That is the whole system. Do it the same day — not at the end of the month,
when you will not remember.

**Keep your business money separate from the house money.** This is the single
change that helps most. If everything is in one place you can never tell whether
the work is profitable or whether you are quietly funding it from somewhere else.
A separate account is best; a separate envelope is a real start.

**Pay yourself.** Decide an amount and take it out regularly, like a wage. If the
business cannot pay it, that is important information — not something to hide by
taking money only when you need it.

**Write down what you are owed.** Orders delivered but not paid for are the
easiest money to lose. A short list, checked weekly, is enough.

**Total it once a month.** Money in, money out, difference. That difference is
whether the month worked. Most women who do this for the first time discover one
of two things: that a product they thought was popular barely makes anything, or
that they are earning more than they believed and can afford to invest.

**Keep bills for what you buy.** If you ever apply for a loan or register the
business, the record is what makes it possible.

When your work grows enough to need registration or tax filing, the same
notebook is what an accountant will ask for. Nothing here is wasted later.""",
    ),
    (
        "your-rights-at-work",
        "Your rights at work",
        "Guide",
        "Pay, hours, safety, maternity and harassment — what you are owed, and what to do when it is denied.",
        """Knowing your rights matters most before something goes wrong, because it
changes what you agree to in the first place.

**Pay.** You are entitled to at least the minimum wage set for your kind of work
in your state, and to be paid on the agreed date. Deductions must be explained.
Being paid less because you are a woman doing the same work is not allowed.

**Hours and rest.** There are legal limits on working hours, and overtime beyond
them is meant to be paid at a higher rate. You are entitled to rest breaks and a
weekly day off.

**A written record.** Ask for something in writing that says who you work for,
what you are paid and when. Many workplaces do not offer it. Asking is normal and
it protects you.

**Safety.** Your workplace must be safe, with clean water and usable toilets.
Injury at work is your employer's responsibility, not yours.

**Maternity.** Women in covered workplaces are entitled to paid maternity leave
and cannot be dismissed for being pregnant. The details of who is covered depend
on the size and type of workplace — ask before you need it.

**Harassment.** Sexual harassment at work is illegal. Workplaces above a certain
size are required to have an Internal Complaints Committee to receive complaints,
and there is a local committee for smaller workplaces and informal work. You are
entitled to complain without being punished for it.

**If something is wrong.** Write down what happened, with dates, as soon as you
can — memory fades and a record is what makes a complaint stick. Talk to someone
you trust before acting alone. A union, a legal aid service, or a women's support
organisation can tell you what applies to your situation.

Labour law in India differs by state and by the size and type of workplace, and
what applies to a factory may not apply to domestic or home-based work. This is
the shape of your rights — for your own situation, speak to a legal aid service
or a support organisation. If you are in immediate danger, contact the police or
a helpline rather than waiting.""",
    ),
    (
        "selling-food-from-home",
        "Selling food you cook at home",
        "Guide",
        "Hygiene, packaging, pricing and the practical side of turning cooking into orders.",
        """Cooking for money is different from cooking for family, mostly in ways that
have nothing to do with the cooking.

**Hygiene is the whole business.** One person falling ill ends a home food
business, and word travels faster than any advertisement. Wash hands properly and
often. Keep raw and cooked food apart. Cook thoroughly and keep hot food hot and
cold food cold. Do not cook for customers when you are unwell.

**Know how long things keep.** Most cooked food is safe for a few hours at room
temperature and no longer. Anything with milk, egg or meat is less forgiving.
Pickles and preserves are a different matter — that is the point of them — but
they need to be made properly to be safe.

**Package so it arrives well.** Leaking containers lose customers faster than bad
taste. Gravy separately from rice or roti. A tight lid and a bag that will not
tip. Label what is inside and the date it was made.

**Price by the dish, not by the day.** Work out the cost of one portion —
ingredients, gas, packaging — then add your time and a profit. Cooking is easy to
do at a loss because ingredients are bought in bulk and portions get forgotten.

**Start small and regular.** A fixed weekly menu with a few dishes is far easier
to price, buy for and cook well than taking any order that comes. Regular
customers who order every week are worth more than occasional large orders.

**Registration.** Selling food generally requires a food licence or registration,
and the requirement scales with the size of the business. The threshold and
process depend on where you are — check locally before you grow, because it is
much easier to register early than to be caught unregistered later.""",
    ),
    (
        "photographing-what-you-make",
        "Photographing what you make",
        "Guide",
        "Getting photos that sell, using the phone you already have.",
        """The photograph is what people buy from. It is worth an hour of care.

**Use daylight, never the flash.** Morning or late afternoon, near a window or
just inside a doorway. Flash flattens colour and makes cloth look cheap. If the
light is only on one side, hold a sheet of white paper on the other side to
bounce some back.

**Use a plain background.** A white or light-coloured sheet, a plain wall, a
wooden table. A busy background makes the eye look at the wrong thing.

**Fill the frame.** Get close. Most photos that do not sell are photographs of a
room with the product somewhere in it.

**Show scale.** A hand holding an earring, a dupatta on a shoulder. People cannot
judge size from an object alone, and returns from "smaller than I expected" are
avoidable.

**Take several.** The whole thing, a close-up of the detail or stitching, and one
of it being worn or used. Three good photographs sell better than ten similar
ones.

**Be honest about the colour.** If the photo is brighter than the real thing, the
customer will be disappointed when it arrives, and that costs more than the sale
was worth. Check the photo against the actual item before you post it.

**Keep them consistent.** The same background and light for everything you sell
makes your whole catalogue look like one business rather than a collection of
snapshots.""",
    ),
]
