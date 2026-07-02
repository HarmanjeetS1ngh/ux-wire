import digest from "../data/digest.json";
import Feed from "./Feed";

export default function Page() {
  return <Feed initialDigest={digest} />;
}
