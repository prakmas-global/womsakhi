import type { Metadata } from "next";

import { DocHeader, ReviewNotice } from "../_DocHeader";

export const metadata: Metadata = {
  title: "Privacy — WomSakhi",
  description: "What WomSakhi collects, why, who can see it, and how to get it removed.",
};

/**
 * The privacy policy.
 *
 * Written against the source rather than from a template. Every claim below was
 * checked: the collections that exist, the encryption that is actually applied,
 * the three companies data really reaches, and the fact that there is no
 * self-service deletion yet — which is stated plainly instead of promised.
 *
 * A woman reads this before handing over a photograph of her Aadhaar card. A
 * policy that describes a system we wish we had would be worse than none.
 */
export default function PrivacyPage() {
  return (
    <article className="doc">
      <DocHeader
        title="Privacy"
        updated="30 August 2026"
        lede="You are about to tell us your name, your phone number, and possibly show us a photograph of your ID. This page says exactly what happens to all of it — in plain words, and only things that are true today."
      />

      <h2>The short version</h2>
      <ul>
        <li>We never sell your data. There is no advertising on WomSakhi and no advertiser is given anything.</li>
        <li><strong>Your ID document is encrypted</strong> and can only be opened by the small review team. It is never shown to other members, employers or buyers.</li>
        <li>Your phone number is not shown to anyone else unless you put it somewhere public yourself.</li>
        <li>Joining is free. We do not charge you to find work, and we never will.</li>
        <li>You can ask us to delete everything, and we will.</li>
      </ul>

      <h2>Who we are</h2>
      <p>
        WomSakhi is operated by PRAKMAS GLOBAL. For anything on this page, write to{" "}
        <a href="mailto:privacy@womsakhi.com">privacy@womsakhi.com</a>.
      </p>

      <h2>What we collect, and why</h2>
      <table>
        <thead>
          <tr><th scope="col">What</th><th scope="col">Why</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Your name and email</strong></td>
            <td>To make your account and to write to you about it. Required.</td>
          </tr>
          <tr>
            <td><strong>Your password</strong></td>
            <td>
              Stored only as a bcrypt hash. Nobody at WomSakhi — including us — can
              read it or recover it. If you forget it we can only help you set a new one.
            </td>
          </tr>
          <tr>
            <td><strong>Your phone number</strong></td>
            <td>Optional. Used to reach you about your own work. Never shown to other members.</td>
          </tr>
          <tr>
            <td><strong>One photo ID</strong></td>
            <td>
              To check that WomSakhi stays a space for women. See the section below —
              this one has its own rules.
            </td>
          </tr>
          <tr>
            <td><strong>What you do here</strong></td>
            <td>
              Courses you enrol in, jobs you apply for, savings circles you join, things
              you list for sale. This is your record; it is what the app shows back to you.
            </td>
          </tr>
          <tr>
            <td><strong>Money</strong></td>
            <td>
              Amounts, orders and wallet entries. <strong>We never see or store your card
              or UPI details</strong> — those go straight to the payment provider.
            </td>
          </tr>
          <tr>
            <td><strong>Safety information</strong></td>
            <td>
              Trusted contacts you choose, and any safety report you make. Only the safety
              team can read a report.
            </td>
          </tr>
          <tr>
            <td><strong>Messages to Sakhi</strong></td>
            <td>The AI assistant. See “When you talk to Sakhi” below.</td>
          </tr>
        </tbody>
      </table>

      <h2>Your ID document</h2>
      <p>
        This is the most sensitive thing you will give us, and it is treated differently
        from everything else.
      </p>
      <ul>
        <li>
          It is <strong>encrypted on our servers</strong> using AES-256-GCM. Somebody who
          obtained the raw files — a stolen backup, a copied disk — would get unreadable
          bytes, not a picture of your ID.
        </li>
        <li>
          It is <strong>never served publicly</strong>. There is no address that shows it
          to the internet, and it is never included in your profile.
        </li>
        <li>
          <strong>Only the review team can open it</strong>, and every single opening is
          recorded — who looked, and when.
        </li>
        <li>It is never shown to other members, to employers, or to buyers.</li>
        <li>
          If your application is rejected, or you close your account, the document is
          deleted.
        </li>
      </ul>

      <h2>Who else your data reaches</h2>
      <p>
        Only these, and only for the job named. None of them is given your data to use
        for their own purposes.
      </p>
      <table>
        <thead>
          <tr><th scope="col">Company</th><th scope="col">What they get</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>MongoDB Atlas</strong></td>
            <td>Hosts the database. Everything above lives there.</td>
          </tr>
          <tr>
            <td><strong>Razorpay</strong></td>
            <td>
              Takes payments. Your card or UPI details go to them and never to us. They
              tell us only whether a payment succeeded.
            </td>
          </tr>
          <tr>
            <td><strong>Anthropic</strong></td>
            <td>
              Runs the AI behind Sakhi. Your message is sent so it can be answered.
            </td>
          </tr>
          <tr>
            <td><strong>Microsoft Azure</strong></td>
            <td>Turns Sakhi&rsquo;s reply into speech, if you use the voice.</td>
          </tr>
          <tr>
            <td><strong>Langfuse</strong></td>
            <td>
              Records Sakhi conversations so we can find and fix bad answers. <strong>Their
              servers are in the United States</strong>, so this data leaves India.
            </td>
          </tr>
          <tr>
            <td><strong>Our email provider</strong></td>
            <td>Delivers account email. They get your address and the message.</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Your ID document is never sent to any of them.</strong> It stays on our
        own servers.
      </p>

      <h2>When you talk to Sakhi</h2>
      <p>
        Sakhi is an AI assistant. What you type is sent to Anthropic to be answered, and
        a copy of the conversation is kept so we can improve the answers and so you can
        read it back later.
      </p>
      <p>
        Sakhi is not a doctor, a lawyer or a counsellor, and it can be wrong. For anything
        that matters — your health, your rights, your safety — use the real helplines the
        app lists rather than relying on Sakhi alone.
      </p>

      <h2>How long we keep things</h2>
      <ul>
        <li><strong>Your account and your records</strong> — for as long as your account is open.</li>
        <li><strong>Your ID document</strong> — until your account closes or your application is rejected.</li>
        <li><strong>Money records</strong> — kept after closure where Indian tax and accounting law requires it.</li>
        <li><strong>Sign-in sessions</strong> — 30 minutes of inactivity, then they expire.</li>
        <li><strong>Password reset links</strong> — 24 hours, and single use.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Under India&rsquo;s Digital Personal Data Protection Act, 2023 you can ask us to
        show you what we hold, correct it, or delete it. Write to{" "}
        <a href="mailto:privacy@womsakhi.com">privacy@womsakhi.com</a> and we will answer
        within 30 days.
      </p>
      <p>
        <strong>How closing your account actually works.</strong> There is a button —
        Settings, then Password and sign-in, then Close your account. Pressing it suspends
        your access straight away and asks our team to erase your data, which we complete
        within 30 days. It is not instant, and we would rather say so than imply otherwise:
        some records have to be kept for a period under Indian tax and accounting law, and
        a person checks that before the rest is deleted. You will get an email when it is
        done. If you would rather not use the button, write to{" "}
        <a href="mailto:privacy@womsakhi.com">privacy@womsakhi.com</a> and we will do the same
        thing.
      </p>

      <h2>How we protect it</h2>
      <ul>
        <li>Passwords are hashed with bcrypt. They are never stored in a readable form.</li>
        <li>ID documents are encrypted at rest with AES-256-GCM.</li>
        <li>Sign-in sessions use a cookie JavaScript cannot read, sent only over HTTPS.</li>
        <li>Five wrong passwords locks sign-in for 15 minutes, so nobody can guess their way in.</li>
        <li>Staff only see what their role allows, and views of an ID document are logged.</li>
      </ul>
      <p>
        No system is perfect. If we ever discover a breach affecting you, we will tell you
        and the Data Protection Board, as the law requires.
      </p>

      <h2>Children</h2>
      <p>
        WomSakhi is for adults. You must be 18 or older to join. If we learn an account
        belongs to a child, we close it and delete the data.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this page in a way that matters, we will email you before it takes
        effect — not quietly update the date.
      </p>

      <ReviewNotice />
    </article>
  );
}
