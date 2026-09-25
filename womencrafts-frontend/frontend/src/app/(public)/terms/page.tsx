import type { Metadata } from "next";

import { DocHeader, ReviewNotice } from "../_DocHeader";

export const metadata: Metadata = {
  title: "Terms — WomSakhi",
  description: "The agreement between you and WomSakhi, in plain words.",
};

/**
 * Terms of use.
 *
 * Deliberately short and readable. The audience is a woman who may be reading
 * her first terms-of-service on a phone in her second language, and a document
 * she cannot get through protects nobody.
 *
 * Every clause matches what the software does — the women-only rule is actually
 * enforced by human review, the free-to-join promise is real, and the fee we do
 * charge is named rather than hidden behind "applicable charges".
 */
export default function TermsPage() {
  return (
    <article className="doc">
      <DocHeader
        title="Terms of use"
        updated="30 August 2026"
        lede="The agreement between you and WomSakhi. We have kept it short, because terms nobody reads protect nobody."
      />

      <h2>1. Who can join</h2>
      <p>
        WomSakhi is <strong>for women, and only for women</strong>. You must be 18 or
        older. Every account is reviewed by a person, which is why we ask for one photo ID.
      </p>
      <p>
        If you are not a woman, you may not use WomSakhi. This is not negotiable and it is
        the reason the platform exists.
      </p>

      <h2>2. What it costs you</h2>
      <p>
        <strong>Joining is free, and it always will be. Nobody at WomSakhi may ever charge
        you to find work.</strong> If anyone asks you for money in exchange for a job on
        this platform, that is fraud — report it to us and we will act.
      </p>
      <p>
        Some things do cost money: a paid course, an item you buy from another member. The
        price is always shown before you pay. Where we take a fee on a sale, the fee is
        shown to you before you list.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>Use your real name. Employers and buyers rely on it.</li>
        <li>Your account is yours alone — do not share your password or let anyone else use it.</li>
        <li>Tell us straight away if you think somebody else has got into it.</li>
        <li>You are responsible for what happens under your account.</li>
      </ul>

      <h2>4. How to behave here</h2>
      <p>Do not:</p>
      <ul>
        <li>Pretend to be someone you are not, or use a fake or borrowed ID.</li>
        <li>Harass, threaten or abuse another member.</li>
        <li>Post another woman&rsquo;s photograph, number or address without her permission.</li>
        <li>Ask a member for money in exchange for work.</li>
        <li>Sell anything illegal, or anything you do not have.</li>
        <li>Scrape the platform, or try to break into it.</li>
      </ul>
      <p>
        We remove accounts that do these things. Where somebody is put in danger, we
        report it to the police.
      </p>

      <h2>5. Work, courses and other members</h2>
      <p>
        WomSakhi introduces you to work, training and other women. <strong>We are not your
        employer</strong>, and we are not a party to the agreements you make with an
        employer, a buyer or another member.
      </p>
      <p>
        We check that accounts belong to real women. We cannot guarantee that every job
        posted is a good one or that every member keeps their word. Use your judgement,
        and tell us when something is wrong — that is how we find it.
      </p>

      <h2>6. Money</h2>
      <ul>
        <li>Payments are handled by our payment provider. We never see your card or UPI details.</li>
        <li>Money in your WomSakhi wallet belongs to you, and you may withdraw it.</li>
        <li>
          A <strong>savings circle</strong> is an agreement between its members. WomSakhi
          keeps the record and moves the money; it does not guarantee that every member
          contributes.
        </li>
        <li>Refunds follow the policy shown on the thing you bought.</li>
      </ul>

      <h2>7. What you post</h2>
      <p>
        What you write, photograph and list stays yours. You give us permission to show it
        on WomSakhi so the platform can work — nothing more. We do not sell it and we do
        not license it to anyone else.
      </p>

      <h2>8. Sakhi</h2>
      <p>
        Sakhi is an AI assistant and it can be wrong. It is not a doctor, a lawyer or a
        counsellor. For your health, your rights or your safety, use the real helplines the
        app lists.
      </p>

      <h2>9. Closing an account</h2>
      <p>
        You may leave whenever you like — write to{" "}
        <a href="mailto:hello@womsakhi.com">hello@womsakhi.com</a>. We may suspend or close an
        account that breaks section 4, or where we believe a member is at risk. Where we
        can, we say why.
      </p>

      <h2>10. What we do not promise</h2>
      <p>
        We work hard to keep WomSakhi running and accurate, but we cannot promise it is
        always available or always error-free. To the extent Indian law allows, WomSakhi is
        provided as it is, and we are not liable for indirect losses.
      </p>
      <p>
        Nothing here limits our responsibility for anything the law does not permit us to
        limit.
      </p>

      <h2>11. Which law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of Hyderabad,
        Telangana have jurisdiction.
      </p>

      <h2>12. Changes</h2>
      <p>
        If we change these terms in a way that matters, we will tell you before it takes
        effect.
      </p>

      <ReviewNotice />
    </article>
  );
}
