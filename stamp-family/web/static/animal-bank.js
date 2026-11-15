(() => {
  const group = (name, entries) => entries.map(([code, animal]) => ({ code, name:animal, group:name }));
  globalThis.STAMP_ANIMAL_BANK = [
    ...group('mammal', [
      ['1F435', 'wajah monyet'], ['1F412', 'monyet'], ['1F98D', 'gorila'], ['1F9A7', 'orangutan'],
      ['1F436', 'wajah anjing'], ['1F415', 'anjing'], ['1F429', 'pudel'], ['1F43A', 'serigala'],
      ['1F98A', 'rubah'], ['1F99D', 'rakun'], ['1F431', 'wajah kucing'], ['1F408', 'kucing'],
      ['1F408-200D-2B1B', 'kucing hitam'], ['1F981', 'singa'], ['1F42F', 'wajah harimau'], ['1F405', 'harimau'],
      ['1F406', 'macan tutul'], ['1F434', 'wajah kuda'], ['1FACE', 'rusa besar'], ['1FACF', 'keledai'],
      ['1F40E', 'kuda'], ['1F984', 'unicorn'], ['1F993', 'zebra'], ['1F98C', 'rusa'],
      ['1F9AC', 'bison'], ['1F42E', 'wajah sapi'], ['1F402', 'lembu'], ['1F403', 'kerbau'],
      ['1F404', 'sapi'], ['1F437', 'wajah babi'], ['1F416', 'babi'], ['1F417', 'babi hutan'],
      ['1F40F', 'domba jantan'], ['1F411', 'domba'], ['1F410', 'kambing'], ['1F42A', 'unta'],
      ['1F42B', 'unta berpunuk dua'], ['1F999', 'llama'], ['1F992', 'jerapah'], ['1F418', 'gajah'],
      ['1F9A3', 'mamut'], ['1F98F', 'badak'], ['1F99B', 'kuda nil'],
    ]),
    ...group('bird', [
      ['1F983', 'kalkun'], ['1F414', 'ayam'], ['1F413', 'ayam jantan'], ['1F423', 'anak ayam menetas'],
      ['1F424', 'anak ayam'], ['1F425', 'anak ayam menghadap depan'], ['1F426', 'burung'], ['1F427', 'penguin'],
      ['1F54A', 'merpati'], ['1F985', 'elang'], ['1F986', 'bebek'], ['1F9A2', 'angsa'],
      ['1F989', 'burung hantu'], ['1F9A4', 'dodo'], ['1F9A9', 'flamingo'], ['1F99A', 'merak'],
      ['1F99C', 'burung nuri'], ['1F426-200D-2B1B', 'burung hitam'], ['1FABF', 'angsa liar'], ['1F426-200D-1F525', 'burung phoenix'],
    ]),
    ...group('reptile', [
      ['1F40A', 'buaya'], ['1F422', 'kura-kura'], ['1F98E', 'kadal'], ['1F40D', 'ular'],
      ['1F432', 'wajah naga'], ['1F409', 'naga'], ['1F995', 'dinosaurus sauropoda'], ['1F996', 'T-Rex'], ['1F438', 'katak'],
    ]),
    ...group('marine', [
      ['1F433', 'paus menyembur'], ['1F40B', 'paus'], ['1F42C', 'lumba-lumba'], ['1FACD', 'orca'],
      ['1F9AD', 'anjing laut'], ['1F41F', 'ikan'], ['1F420', 'ikan tropis'], ['1F421', 'ikan buntal'],
      ['1F988', 'hiu'], ['1F419', 'gurita'], ['1FABC', 'ubur-ubur'], ['1F980', 'kepiting'],
      ['1F99E', 'lobster'], ['1F990', 'udang'], ['1F991', 'cumi-cumi'], ['1F9AA', 'tiram'],
    ]),
    ...group('bug', [
      ['1F40C', 'siput'], ['1F98B', 'kupu-kupu'], ['1F41B', 'serangga'], ['1F41C', 'ulat'],
      ['1F41D', 'lebah madu'], ['1FAB2', 'kumbang'], ['1F41E', 'kepik'], ['1F997', 'jangkrik'],
      ['1FAB3', 'kecoak'], ['1F577', 'laba-laba'], ['1F982', 'kalajengking'], ['1F99F', 'nyamuk'],
    ]),
  ];
})();
