import { describe, expect, it } from "vitest";
import { parseLoginEmail } from "./login-email";

describe("parseLoginEmail", () => {
  it("accepts a normal address as it is", () => {
    expect(parseLoginEmail("anna@example.com")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it("drops spaces at the edges", () => {
    expect(parseLoginEmail("  anna@example.com \n")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it("makes the address lower case", () => {
    expect(parseLoginEmail("Anna@Example.COM")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it("drops spaces and lowers the case together", () => {
    expect(parseLoginEmail("  Anna@Example.COM  ")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it("accepts the usual extras: a plus tag, dots, dashes, subdomains", () => {
    expect(parseLoginEmail("anna.k+crm@mail.example-site.co.uk")).toEqual({
      ok: true,
      email: "anna.k+crm@mail.example-site.co.uk",
    });
  });

  it.each([
    ["an empty string", ""],
    ["only spaces", "   "],
    ["nothing", null],
    ["no domain after @", "anna@"],
    ["no name before @", "@example.com"],
    ["no @ at all", "anna.example.com"],
    ["a domain without a dot", "anna@example"],
    ["a dot at the end of the domain", "anna@example."],
    ["a space inside", "an na@example.com"],
    ["a space after @", "anna@ example.com"],
    ["two @", "anna@@example.com"],
    ["a second @ in the domain", "anna@example@com"],
    ["a comma instead of a dot", "anna@example,com"],
  ])("rejects %s", (_case, raw) => {
    expect(parseLoginEmail(raw)).toEqual({
      ok: false,
      error: "Проверьте адрес почты",
    });
  });

  it("rejects an address longer than 254 characters", () => {
    const local = "a".repeat(250);
    expect(parseLoginEmail(`${local}@example.com`)).toEqual({
      ok: false,
      error: "Проверьте адрес почты",
    });
  });
});
